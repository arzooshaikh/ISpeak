import React from "react";

/**
 * GazeDebug — shows a red dot that follows gaze + raw coords.
 * Drop this anywhere to verify WebGazer is working.
 */
export default function GazeDebug({ gazeX, gazeY, isReady }) {
  if (!isReady) return null;
  return (
    <>
      <div style={{
        position: "fixed", bottom: 16, left: 16,
        background: "#1e293b", padding: "6px 14px",
        borderRadius: 8, fontSize: 12, color: "#94a3b8",
        fontFamily: "monospace", zIndex: 9998,
      }}>
        gaze ({Math.round(gazeX)}, {Math.round(gazeY)})
      </div>
      <div style={{
        position: "fixed",
        left: gazeX, top: gazeY,
        width: 20, height: 20, borderRadius: "50%",
        background: "rgba(239,68,68,0.5)",
        border: "2px solid #ef4444",
        transform: "translate(-50%,-50%)",
        pointerEvents: "none", zIndex: 9999,
        transition: "left 0.05s, top 0.05s",
      }} />
    </>
  );
}
