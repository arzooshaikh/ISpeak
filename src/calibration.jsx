import React, { useState, useRef, useEffect } from "react";
import SOSButton from "../shared/SOSButton";
import { getPatientAccuracyConfig } from "./gaze/useOrloskyGaze";

// We place a 3x3 grid inside this region
function buildROIPoints() {
  const xs = [20, 50, 80];
  const ys = [32, 55, 75];
  const pts = [];
  for (const y of ys) for (const x of xs) pts.push({ x, y });
  return pts;
}
const CALIB_POINTS = buildROIPoints(); // 9 points within button region

export default function Calibration({
  addCalibrationPoint, finalizeCalibration,
  getCurrentRatio, onDone, isReady, patientId,
}) {
  const [pointIdx, setPointIdx]   = useState(0);
  const [clicks, setClicks]       = useState(0);
  const [sampling, setSampling]   = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  // Load adaptive accuracy parameters
  const accuracyConfig = getPatientAccuracyConfig(patientId);
  const clicksPerPoint = accuracyConfig ? accuracyConfig.clicksPerPoint : 8;
  const samplesPerClick = accuracyConfig ? accuracyConfig.samplesPerClick : 5;

  const point      = CALIB_POINTS[pointIdx];
  const total      = CALIB_POINTS.length * clicksPerPoint;
  const done       = pointIdx * clicksPerPoint + clicks;
  const pct        = (done / total) * 100;
  const dotOpacity = 0.35 + (clicks / clicksPerPoint) * 0.65;
  const dotSize    = 60 + clicks * 3; // grows as you click it

  async function handleClick(e) {
    if (sampling || !isReady) return;
    setSampling(true);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 120);

    const sx = e.clientX;
    const sy = e.clientY;

    // Take multiple samples and average for stability
    const samples = [];
    for (let i = 0; i < samplesPerClick; i++) {
      await new Promise(r => setTimeout(r, 40));
      const ratio = getCurrentRatio();
      if (ratio) samples.push(ratio);
    }

    if (samples.length > 0) {
      const avgRatio = {
        rx: samples.reduce((s, r) => s + r.rx, 0) / samples.length,
        ry: samples.reduce((s, r) => s + r.ry, 0) / samples.length,
      };
      addCalibrationPoint(sx, sy, avgRatio);
    }

    const nextClicks = clicks + 1;
    if (nextClicks >= clicksPerPoint) {
      if (pointIdx + 1 >= CALIB_POINTS.length) {
        finalizeCalibration();
        try {
          localStorage.setItem("ispeak_calibration", JSON.stringify({
            timestamp: Date.now(),
            patientId: patientId || null,
            roiCalibrated: true,
          }));
        } catch (_) {}
        onDone();
      } else {
        setPointIdx(i => i + 1);
        setClicks(0);
      }
    } else {
      setClicks(nextClicks);
    }

    setSampling(false);
  }

  // Draw faint ROI boundary so caregiver sees the zone
  const roiStyle = {
    position: "absolute",
    left: "15%", top: "28%",
    width: "70%", height: "50%",
    border: "1px dashed #334155",
    borderRadius: 20,
    pointerEvents: "none",
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed", inset: 0,
        background: "#0f172a",
        cursor: sampling ? "wait" : isReady ? "crosshair" : "default",
        zIndex: 1000, fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* SOS always available */}
      <SOSButton patientId={patientId} />

      {/* Click flash feedback */}
      {showFlash && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(249,115,22,0.06)",
          pointerEvents: "none",
        }} />
      )}

      {/* ROI boundary hint */}
      <div style={roiStyle} />
      <div style={{
        position: "absolute",
        left: "15%", top: "calc(28% - 20px)",
        fontSize: 11, color: "#334155", pointerEvents: "none",
      }}>
        Button area
      </div>

      {/* Instructions */}
      <div style={{
        position: "absolute", top: "8%", left: "50%",
        transform: "translateX(-50%)",
        textAlign: "center", pointerEvents: "none",
        lineHeight: 1.8,
      }}>
        <div style={{ fontSize: 22, color: "#f8fafc", fontWeight: 700, marginBottom: 6 }}>
          {isReady ? "Eye Calibration" : "Starting camera..."}
        </div>
        {isReady ? (
          <div style={{ fontSize: 14, color: "#64748b" }}>
            Look at the <span style={{ color: "#f97316", fontWeight: 600 }}>orange dot</span> and click it.
            Keep your <strong style={{ color: "#94a3b8" }}>head still</strong> — only move your eyes.<br />
            <span style={{ fontSize: 12, color: "#475569", marginTop: 4, display: "block" }}>
              Point {pointIdx + 1} of {CALIB_POINTS.length} &nbsp;•&nbsp; {clicks}/{clicksPerPoint} clicks
            </span>
          </div>
        ) : (
          <div style={{ color: "#64748b", fontSize: 14 }}>
            Waiting for MediaPipe face tracking...
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)",
        width: 300, height: 5, borderRadius: 99, background: "#1e293b",
      }}>
        <div style={{
          height: "100%", borderRadius: 99, background: "#f97316",
          width: `${pct}%`, transition: "width 0.25s",
        }} />
      </div>
      <div style={{
        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
        fontSize: 12, color: "#475569",
      }}>
        {Math.round(pct)}% — calibrating to button region for {clicksPerPoint > 8 ? "enhanced" : "better"} accuracy
      </div>

      {/* The dot */}
      {isReady && (
        <div style={{
          position: "absolute",
          left: `${point.x}%`,
          top: `${point.y}%`,
          transform: "translate(-50%, -50%)",
          width: dotSize, height: dotSize,
          borderRadius: "50%",
          background: `rgba(249,115,22,${dotOpacity})`,
          border: "4px solid #f97316",
          boxShadow: `0 0 ${20 + clicks * 5}px #f97316`,
          transition: "width 0.1s, height 0.1s, box-shadow 0.1s, left 0.35s, top 0.35s",
          pointerEvents: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 13,
        }}>
          {sampling ? "⟳" : `${clicks}/${clicksPerPoint}`}
        </div>
      )}
    </div>
  );
}