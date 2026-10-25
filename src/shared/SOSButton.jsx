import React, { useRef, useState } from "react";
import { useDwellTime } from "../gaze/useDwellTime";
import { createSOS } from "./api";

/**
 * SOSButton — fixed top-right emergency button.
 * Dwell for 2s to trigger. Shows confirmation flash.
 */
export default function SOSButton({ patientId }) {
  const ref = useRef(null);
  const [fired, setFired] = useState(false);

  async function handleSOS() {
    if (fired) return;
    setFired(true);
    try {
      await createSOS({ patientId: patientId || 1 });
    } catch (e) {
      console.error("SOS failed", e);
    }
    setTimeout(() => setFired(false), 4000);
  }

  const { dwelling, pct } = useDwellTime(ref, 2000, handleSOS);

  return (
    <div
      ref={ref}
      onClick={handleSOS}
      style={{
        position: "fixed",
        top: 16, right: 16,
        width: 80, height: 80,
        borderRadius: "50%",
        background: fired ? "#22c55e" : dwelling ? "#dc2626" : "#7f1d1d",
        border: `4px solid ${fired ? "#4ade80" : "#dc2626"}`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer", zIndex: 200,
        boxShadow: fired
          ? "0 0 30px 10px #22c55e88"
          : dwelling
          ? "0 0 30px 10px #dc262688"
          : "0 4px 20px rgba(0,0,0,0.4)",
        transform: dwelling ? "scale(1.1)" : "scale(1)",
        transition: "all 0.15s",
        userSelect: "none",
      }}
    >
      {/* Dwell ring */}
      <div style={{
        position: "absolute", inset: -5, borderRadius: "50%",
        background: dwelling ? `conic-gradient(#ef4444 ${pct}%, transparent ${pct}%)` : "transparent",
        opacity: dwelling ? 1 : 0, pointerEvents: "none",
      }} />
      <span style={{ fontSize: 26 }}>{fired ? "✓" : "🆘"}</span>
      <span style={{ fontSize: 9, color: "#fca5a5", fontWeight: 700, letterSpacing: 1 }}>
        {fired ? "SENT" : "SOS"}
      </span>
    </div>
  );
}
