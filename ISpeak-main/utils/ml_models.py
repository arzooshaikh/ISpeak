"""
utils/ml_models.py

Two AI layers for ISpeak:

1. Ridge Regression — per-patient gaze calibration model.
   Learns each patient's iris ratio → screen coordinate mapping.
   Improves over time as more calibration data is collected.
   Replaces the simple linear regression in the frontend.

2. Isolation Forest — anomaly detection on SymptomReport history.
   Detects unusual pain patterns and alerts doctor proactively.
   Replaces the hardcoded rule in views.py run_anomaly_check().
"""

import numpy as np
import pickle
import logging
from sklearn.linear_model import Ridge
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


# ── 1. Ridge Regression — per-patient gaze model ─────────────────────────────

class PatientGazeModel:
    """
    Fits a Ridge Regression model for a single patient mapping
    iris ratios (rx, ry) → screen coordinates (sx, sy).

    Ridge is better than plain linear regression here because:
    - It handles multicollinearity between rx and ry
    - It regularises when data is sparse (early sessions)
    - It generalises better as more data is added over time
    """

    def __init__(self, alpha=1.0):
        self.model_x  = Ridge(alpha=alpha)
        self.model_y  = Ridge(alpha=alpha)
        self.fitted   = False
        self.n_points = 0

    def fit(self, calibration_points):
        """
        calibration_points: list of CalibrationData ORM objects
        Each has: gaze_x (iris rx), gaze_y (iris ry), screen_x, screen_y
        """
        if len(calibration_points) < 4:
            logger.warning("Not enough calibration points to fit Ridge model (need >= 4)")
            return False

        X  = np.array([[p.gaze_x, p.gaze_y] for p in calibration_points])
        Sx = np.array([p.screen_x for p in calibration_points])
        Sy = np.array([p.screen_y for p in calibration_points])

        self.model_x.fit(X, Sx)
        self.model_y.fit(X, Sy)
        self.fitted   = True
        self.n_points = len(calibration_points)
        logger.info("PatientGazeModel fitted on %d points", self.n_points)
        return True

    def predict(self, rx, ry):
        """Returns (screen_x, screen_y) for given iris ratios."""
        if not self.fitted:
            raise ValueError("Model not fitted yet")
        X  = np.array([[rx, ry]])
        sx = float(self.model_x.predict(X)[0])
        sy = float(self.model_y.predict(X)[0])
        return sx, sy

    def to_coefficients(self):
        """
        Returns a dict the frontend can use directly:
        { ax, bx, ay, by } — matching the format in useMediaPipeGaze.js
        This lets the frontend skip the fallback mapping entirely.
        """
        if not self.fitted:
            return None
        # Ridge: sx = coef_x[0]*rx + coef_x[1]*ry + intercept_x
        # For compatibility with the frontend linear model: ax=coef[0], bx=intercept
        # We include ry coefficient as well so frontend can use it
        return {
            "ax":  float(self.model_x.coef_[0]),
            "bx":  float(self.model_x.intercept_),
            "ary": float(self.model_x.coef_[1]),   # ry contribution to x
            "ay":  float(self.model_y.coef_[1]),
            "by":  float(self.model_y.intercept_),
            "arx": float(self.model_y.coef_[0]),   # rx contribution to y
            "n_points": self.n_points,
        }

    def serialize(self):
        return pickle.dumps(self)

    @staticmethod
    def deserialize(data):
        return pickle.loads(data)


def get_or_train_gaze_model(patient_id):
    """
    Load all CalibrationData for a patient and return a fitted PatientGazeModel.
    Call this from the calibration API endpoint to return coefficients to frontend.
    """
    from ispeak.models import CalibrationData
    points = list(CalibrationData.objects.filter(patient_id=patient_id).order_by("created_at"))

    model = PatientGazeModel(alpha=0.5)
    success = model.fit(points)
    return model if success else None


# ── 2. Isolation Forest — anomaly detection ───────────────────────────────────

# Feature encoding maps
EMOTION_MAP  = {"happy": 0, "neutral": 1, "pain": 2}
BODY_MAP     = {
    "head": 0, "neck": 1, "chest": 2, "left_arm": 3,
    "right_arm": 4, "stomach": 5, "back": 6, "left_leg": 7, "right_leg": 8,
}
PAIN_MAP     = {
    "sharp": 0, "burning": 1, "pressure": 2,
    "throbbing": 3, "numb": 4, "cant_describe": 5,
}


def report_to_features(report):
    """Convert a SymptomReport ORM object to a feature vector."""
    return [
        EMOTION_MAP.get(report.emotion, -1),
        BODY_MAP.get(report.body_part, -1),
        report.severity,
        PAIN_MAP.get(report.pain_type, -1),
    ]


def run_anomaly_detection(new_report, patient_id):
    """
    Run Isolation Forest on this patient's report history.
    Returns (is_anomaly: bool, message: str)

    Falls back to rule-based check if patient has < 5 historical reports
    (not enough data for Isolation Forest to be meaningful).

    Call this from SymptomReportViewSet.create() instead of the hardcoded check.
    """
    from ispeak.models import SymptomReport

    # Get historical reports for this patient (excluding the new one)
    history = list(
        SymptomReport.objects
        .filter(patient_id=patient_id)
        .exclude(id=new_report.id)
        .order_by("-timestamp")[:100]   # last 100 reports max
    )

    new_features = report_to_features(new_report)

    # ── Not enough history → rule-based fallback ──
    if len(history) < 5:
        if new_report.severity == 5 and new_report.emotion == "pain":
            return True, "Critical: maximum severity pain reported."
        if new_report.severity >= 4:
            return True, f"High severity ({new_report.severity}/5) {new_report.body_part} pain reported."
        return False, ""

    # ── Isolation Forest ──
    X_history = np.array([report_to_features(r) for r in history])

    # Add the new report so we can score it
    X_all     = np.vstack([X_history, new_features])

    scaler    = StandardScaler()
    X_scaled  = scaler.fit_transform(X_all)

    # contamination: expect ~5% of reports to be anomalous
    clf = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42,
    )
    clf.fit(X_scaled[:-1])   # fit on history only

    # Score the new report
    score      = clf.score_samples(X_scaled[-1].reshape(1, -1))[0]
    prediction = clf.predict(X_scaled[-1].reshape(1, -1))[0]  # -1 = anomaly

    is_anomaly = (prediction == -1)

    if not is_anomaly:
        return False, ""

    # Build a human-readable message
    messages = []

    # Severity jump
    avg_severity = float(np.mean([r.severity for r in history]))
    if new_report.severity > avg_severity + 1.5:
        messages.append(
            f"Severity {new_report.severity}/5 is significantly above this patient's average ({avg_severity:.1f})"
        )

    # Unusual body part
    body_counts  = {}
    for r in history:
        body_counts[r.body_part] = body_counts.get(r.body_part, 0) + 1
    if body_counts.get(new_report.body_part, 0) == 0:
        messages.append(f"First time reporting {new_report.body_part.replace('_', ' ')} pain")

    # Unusual emotion+body combination
    combo = f"{new_report.emotion}+{new_report.body_part}"
    combos = [f"{r.emotion}+{r.body_part}" for r in history]
    if combos.count(combo) == 0:
        messages.append(f"Unusual combination: {new_report.emotion} with {new_report.body_part.replace('_', ' ')}")

    # Always flag max severity
    if new_report.severity == 5:
        messages.append("Maximum severity reported — immediate attention recommended")

    msg = ". ".join(messages) if messages else f"Unusual pain pattern detected (anomaly score: {score:.3f})"
    return True, msg