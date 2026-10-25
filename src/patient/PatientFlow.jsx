import React, { useState, useEffect, useRef } from "react";
import { useOrloskyGaze } from "../gaze/useOrloskyGaze";
import { useGazeQuality }   from "../gaze/useGazeQuality";
import { gazeRegistry }     from "../gaze/gazeRegistry";
import Calibration          from "../gaze/Calibration";
import EmotionScreen        from "./EmotionScreen";
import BodyPartScreen       from "./BodyPartScreen";
import SeverityScreen       from "./SeverityScreen";
import PainTypeScreen       from "./PainTypeScreen";
import ConfirmationScreen   from "./ConfirmationScreen";

// How far (px) gaze can be from a button center and still snap to it.
// If gaze is further than this, it stays at the raw position.
const SNAP_RADIUS = 180;

export default function PatientFlow({ patientId, onSessionComplete }) {
  const [screen, setScreen] = useState("init");
  const [selections, setSelections] = useState({
    emotion: null, bodyPart: null, severity: null, painType: null,
  });
  const [dotPos, setDotPos] = useState({ x: 0, y: 0 });

  const quality = useGazeQuality();
  const {
    gazeX, gazeY, isReady, isCalibrated,
    mediaError,
    addCalibrationPoint, finalizeCalibration, resetCalibration, getCurrentRatio,
  } = useOrloskyGaze({ patientId: parseInt(patientId) });

  // Snap gaze to nearest button and re-dispatch
  useEffect(() => {
    const handleRaw = (e) => {
      const { x, y } = e.detail;
      const nearest = gazeRegistry.findNearest(x, y);

      let snapped;
      if (nearest && nearest.distance < SNAP_RADIUS) {
        snapped = { x: nearest.snappedX, y: nearest.snappedY };
      } else {
        snapped = { x, y };
      }

      setDotPos(snapped);

      // Re-dispatch snapped coordinates for useDwellTime to consume
      window.dispatchEvent(
        new CustomEvent("gaze-snapped", { detail: snapped })
      );
    };

    window.addEventListener("gaze-update", handleRaw);
    return () => window.removeEventListener("gaze-update", handleRaw);
  }, []);

  // Adaptive skipping of calibration if patient model exists in localStorage
  useEffect(() => {
    if (isReady && screen === "init") {
      if (isCalibrated) {
        console.log("[PatientFlow] Found calibration. Bypassing calibration screen.");
        setScreen("emotion");
      } else {
        setScreen("calibrating");
      }
    }
  }, [isReady, isCalibrated, screen]);

  function select(field, value) {
    setSelections(s => ({ ...s, [field]: value }));
    const next = { emotion: "bodyPart", bodyPart: "severity", severity: "painType", painType: "confirm" };
    setScreen(next[field]);
  }

  function goBack() {
    const prev = { bodyPart: "emotion", severity: "bodyPart", painType: "severity", confirm: "painType" };
    setScreen(s => prev[s] || s);
  }

  // 3x Daily Compliance calculations
  const getTodayCheckinsCount = () => {
    try {
      const reports = JSON.parse(localStorage.getItem("ispeak_mock_reports") || "[]");
      const todayStr = new Date().toDateString();
      const pId = parseInt(patientId);
      const count = reports.filter(r => r.patientId === pId && new Date(r.timestamp).toDateString() === todayStr).length;
      return count;
    } catch (_) {
      return 0;
    }
  };

  const checkinsCount = getTodayCheckinsCount();

  if (mediaError) return (
    <div style={centerStyle}>
      <div style={{ color: "#fca5a5", textAlign: "center", maxWidth: 360 }}>
        ✗ {mediaError}<br/>
        <span style={{ fontSize: 13, color: "#64748b" }}>Check camera permissions and reload.</span>
      </div>
    </div>
  );

  if (screen === "init") return (
    <div style={centerStyle}>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#94a3b8", fontSize: 18, marginBottom: 8 }}>◌ Loading face tracking...</div>
        <div style={{ color: "#475569", fontSize: 13 }}>This takes a few seconds on first load</div>
      </div>
    </div>
  );

  if (screen === "calibrating") return (
    <Calibration
      patientId={parseInt(patientId)}
      isReady={isReady}
      addCalibrationPoint={addCalibrationPoint}
      finalizeCalibration={finalizeCalibration}
      getCurrentRatio={getCurrentRatio}
      onDone={() => setScreen("emotion")}
    />
  );

  return (
    <>
      {/* 3x Daily Progress Badge */}
      <div style={{
        position: "fixed", top: 16, right: 110,
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: 20, padding: "6px 14px", display: "flex", gap: 10,
        alignItems: "center", zIndex: 300, fontSize: 12, fontWeight: 700,
        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
      }}>
        <span style={{ color: "#94a3b8" }}>Today's Checks:</span>
        <span style={{ display: "flex", gap: 6, fontSize: 14 }}>
          <span style={{ opacity: checkinsCount >= 1 ? 1 : 0.25, filter: checkinsCount >= 1 ? "none" : "grayscale(100%)", transition: "all 0.3s" }} title="Morning check-in">☀️</span>
          <span style={{ opacity: checkinsCount >= 2 ? 1 : 0.25, filter: checkinsCount >= 2 ? "none" : "grayscale(100%)", transition: "all 0.3s" }} title="Afternoon check-in">🌤️</span>
          <span style={{ opacity: checkinsCount >= 3 ? 1 : 0.25, filter: checkinsCount >= 3 ? "none" : "grayscale(100%)", transition: "all 0.3s" }} title="Evening check-in">🌙</span>
        </span>
      </div>

      {quality.warning && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          background: "#7f1d1d", color: "#fca5a5", padding: "8px 20px",
          borderRadius: 999, fontSize: 13, fontWeight: 600, zIndex: 300,
        }}>
          ⚠ Please look directly at the screen
        </div>
      )}

      <button onClick={() => { resetCalibration(); setScreen("calibrating"); }} style={{
        position: "fixed", top: 16, left: 16,
        background: "#1e293b", color: "#64748b",
        border: "1px solid #334155", borderRadius: 8,
        padding: "6px 12px", fontSize: 12, cursor: "pointer", zIndex: 300,
      }}>↺ Recalibrate</button>

      {screen === "emotion"  && <EmotionScreen  patientId={parseInt(patientId)} onSelect={v => select("emotion",  v)} />}
      {screen === "bodyPart" && <BodyPartScreen  patientId={parseInt(patientId)} onSelect={v => select("bodyPart", v)} onBack={goBack} />}
      {screen === "severity" && <SeverityScreen  patientId={parseInt(patientId)} onSelect={v => select("severity", v)} onBack={goBack} />}
      {screen === "painType" && <PainTypeScreen  patientId={parseInt(patientId)} onSelect={v => select("painType", v)} onBack={goBack} />}
      {screen === "confirm"  && (
        <ConfirmationScreen
          patientId={parseInt(patientId)}
          selections={selections}
          onConfirm={onSessionComplete}
          onBack={goBack}
        />
      )}

      {/* Gaze dot — snapped to nearest button */}
      <div style={{
        position: "fixed",
        width: 24, height: 24, borderRadius: "50%",
        background: "rgba(99,102,241,0.35)",
        border: "2px solid #6366f1",
        pointerEvents: "none", zIndex: 9999,
        left: dotPos.x, top: dotPos.y,
        transform: "translate(-50%,-50%)",
        transition: "left 0.08s ease-out, top 0.08s ease-out",
      }} />

      {/* Debug bar */}
      <div style={{
        position: "fixed", bottom: 16, left: 16,
        background: "#1e293b", color: "#94a3b8",
        padding: "6px 12px", borderRadius: 8, fontSize: 11,
        fontFamily: "monospace", zIndex: 9999,
      }}>
        gaze ({Math.round(gazeX)}, {Math.round(gazeY)}) | calibrated: {isCalibrated ? "yes" : "no"} | ready: {isReady ? "yes" : "no"}
      </div>
    </>
  );
}

const centerStyle = {
  background: "#0f172a", minHeight: "100vh",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "system-ui, sans-serif", color: "#f8fafc",
};
