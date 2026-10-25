"""
utils/orlosky_pupil_tracker.py

Python wrapper around the JEOresearch/EyeTracker pupil detection algorithm.
Adapted from: https://github.com/JEOresearch/EyeTracker (FrontCameraTracker variant)

Runs the Orlosky pupil detector in a background thread.
Emits normalised gaze data (rx, ry in [0,1]) and blink events via a queue.

The Django Channels GazeConsumer reads from this queue and forwards
data to the browser over WebSocket.
"""

import cv2
import math
import threading
import time
import queue
import numpy as np
import logging

logger = logging.getLogger(__name__)

# ── Tuning constants ──────────────────────────────────────────────────────────
CAMERA_INDEX = 0          # Webcam index (0 = default/built-in)
FRAME_WIDTH  = 640
FRAME_HEIGHT = 480
TARGET_FPS   = 30

# Pupil detection thresholds
ADDED_THRESHOLD     = 35   # Binary threshold offset above darkest pixel
MIN_CONTOUR_AREA    = 80   # Minimum pixel area for a pupil candidate contour
MAX_CONTOUR_RATIO   = 3.0  # Max width:height ratio (reject too-elongated shapes)
MIN_ELLIPSE_POINTS  = 5    # Minimum contour points to fit an ellipse
CONFIDENCE_THRESHOLD = 0.55  # Minimum ellipse-to-contour overlap ratio

# Blink / eye-closure heuristics
BLINK_MIN_FRAMES = 2     # Minimum consecutive frames with no detection → blink start
BLINK_MAX_FRAMES = 15    # Consecutive detection-loss frames → "hold" (long blink/dwell)


# ── Pupil geometry helpers ────────────────────────────────────────────────────

def apply_binary_threshold(image, darkest_value, added_threshold):
    threshold = darkest_value + added_threshold
    _, thresh = cv2.threshold(image, threshold, 255, cv2.THRESH_BINARY_INV)
    return thresh


def get_darkest_area(gray, ignore=20, skip=10, search=20, inner_skip=5):
    """Fast sparse search for the darkest square region (likely the pupil)."""
    min_sum = float("inf")
    darkest = None
    h, w = gray.shape
    for y in range(ignore, h - ignore, skip):
        for x in range(ignore, w - ignore, skip):
            total = 0
            n = 0
            for dy in range(0, search, inner_skip):
                if y + dy >= h:
                    break
                for dx in range(0, search, inner_skip):
                    if x + dx >= w:
                        break
                    total += int(gray[y + dy, x + dx])
                    n += 1
            if n > 0 and total < min_sum:
                min_sum = total
                darkest = (x + search // 2, y + search // 2)
    return darkest


def mask_square(image, center, size):
    x, y = center
    h = size // 2
    mask = np.zeros_like(image)
    x0, y0 = max(0, x - h), max(0, y - h)
    x1, y1 = min(image.shape[1], x + h), min(image.shape[0], y + h)
    mask[y0:y1, x0:x1] = 255
    return cv2.bitwise_and(image, mask)


def filter_contours(contours, min_area, max_ratio):
    """Return the single largest contour that passes area + shape filters."""
    best, best_area = None, 0
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        x, y, cw, ch = cv2.boundingRect(c)
        ratio = max(cw / ch, ch / cw) if ch > 0 and cw > 0 else 99
        if ratio > max_ratio:
            continue
        if area > best_area:
            best_area = area
            best = c
    return best


def ellipse_confidence(contour, image_shape):
    """
    Measure how well the contour fits an ellipse.
    Returns a float in [0, 1]: fraction of contour pixels that fall
    within a thin band around the fitted ellipse.
    """
    if len(contour) < MIN_ELLIPSE_POINTS:
        return 0.0
    contour_mask = np.zeros(image_shape[:2], dtype=np.uint8)
    cv2.drawContours(contour_mask, [contour], -1, 255, 1)

    ellipse = cv2.fitEllipse(contour)
    ellipse_mask = np.zeros(image_shape[:2], dtype=np.uint8)
    cv2.ellipse(ellipse_mask, ellipse, 255, 4)

    overlap = cv2.bitwise_and(contour_mask, ellipse_mask)
    total = np.count_nonzero(contour_mask)
    if total == 0:
        return 0.0
    return np.count_nonzero(overlap) / total


def detect_pupil(frame):
    """
    Detect the pupil ellipse in a BGR frame.

    Returns:
        ellipse : cv2 RotatedRect tuple ((cx,cy),(w,h),angle) or None
        confidence : float [0,1]
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (7, 7), 0)

    darkest = get_darkest_area(gray)
    if darkest is None:
        return None, 0.0

    darkest_value = int(gray[darkest[1], darkest[0]])

    # Restrict search to a 200×200 window around the darkest area
    roi = mask_square(gray, darkest, 200)
    thresh = apply_binary_threshold(roi, darkest_value, ADDED_THRESHOLD)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None, 0.0

    best = filter_contours(contours, MIN_CONTOUR_AREA, MAX_CONTOUR_RATIO)
    if best is None or len(best) < MIN_ELLIPSE_POINTS:
        return None, 0.0

    conf = ellipse_confidence(best, frame.shape)
    if conf < CONFIDENCE_THRESHOLD:
        return None, conf

    ellipse = cv2.fitEllipse(best)
    return ellipse, conf


# ── Gaze normalisation ────────────────────────────────────────────────────────

def pupil_to_ratio(ellipse, frame_w, frame_h):
    """
    Convert a detected pupil ellipse centre to normalised [0,1] gaze ratios.

    rx=0 → left of frame, rx=1 → right
    ry=0 → top of frame,  ry=1 → bottom
    Note: webcam images are mirrored, so rx is inverted.
    """
    (cx, cy), _, _ = ellipse
    rx = 1.0 - (cx / frame_w)   # invert for mirror
    ry = cy / frame_h
    rx = max(0.0, min(1.0, rx))
    ry = max(0.0, min(1.0, ry))
    return rx, ry


# ── Background tracker thread ─────────────────────────────────────────────────

class OrloskyPupilTracker:
    """
    Runs the Orlosky pupil detector in a daemon thread.
    Results are pushed to `self.queue` as dicts:

        { "type": "gaze", "rx": float, "ry": float, "conf": float }
        { "type": "blink" }
        { "type": "hold" }
        { "type": "error", "message": str }
        { "type": "ready" }
        { "type": "stopped" }
    """

    def __init__(self, camera_index=CAMERA_INDEX, queue_size=60):
        self.camera_index = camera_index
        self.queue: queue.Queue = queue.Queue(maxsize=queue_size)
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="OrloskyTracker")
        self._thread.start()
        logger.info("[OrloskyPupilTracker] Started.")

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3)
        logger.info("[OrloskyPupilTracker] Stopped.")

    def _emit(self, item):
        try:
            self.queue.put_nowait(item)
        except queue.Full:
            try:
                self.queue.get_nowait()
                self.queue.put_nowait(item)
            except queue.Empty:
                pass

    def _run(self):
        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            self._emit({"type": "error", "message": f"Cannot open camera {self.camera_index}"})
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
        cap.set(cv2.CAP_PROP_FPS, TARGET_FPS)

        self._emit({"type": "ready"})

        no_detect_frames = 0   # consecutive frames without pupil detection
        interval = 1.0 / TARGET_FPS

        try:
            while not self._stop_event.is_set():
                t0 = time.monotonic()
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.05)
                    continue

                ellipse, conf = detect_pupil(frame)

                if ellipse is not None:
                    # ── Blink detection: track return from no-detection gap ──
                    if BLINK_MIN_FRAMES <= no_detect_frames <= BLINK_MAX_FRAMES:
                        self._emit({"type": "blink"})
                    elif no_detect_frames > BLINK_MAX_FRAMES:
                        self._emit({"type": "hold"})
                    no_detect_frames = 0

                    rx, ry = pupil_to_ratio(ellipse, frame.shape[1], frame.shape[0])
                    self._emit({"type": "gaze", "rx": rx, "ry": ry, "conf": conf})
                else:
                    no_detect_frames += 1

                # Pace to target FPS
                elapsed = time.monotonic() - t0
                sleep = interval - elapsed
                if sleep > 0:
                    time.sleep(sleep)
        finally:
            cap.release()
            self._emit({"type": "stopped"})
            logger.info("[OrloskyPupilTracker] Camera released.")


# ── Singleton instance (shared across consumer connections) ───────────────────

_tracker_instance: OrloskyPupilTracker | None = None
_tracker_lock = threading.Lock()


def get_tracker() -> OrloskyPupilTracker:
    """Return (and lazily start) the singleton tracker instance."""
    global _tracker_instance
    with _tracker_lock:
        if _tracker_instance is None:
            _tracker_instance = OrloskyPupilTracker()
            _tracker_instance.start()
    return _tracker_instance


def shutdown_tracker():
    """Stop the singleton tracker (call on Django shutdown)."""
    global _tracker_instance
    with _tracker_lock:
        if _tracker_instance is not None:
            _tracker_instance.stop()
            _tracker_instance = None
