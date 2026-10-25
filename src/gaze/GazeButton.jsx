import React, { useRef } from "react";
import { useDwellTime } from "./useDwellTime";

/**
 * GazeButton — a button-like element that fires onGazeSelect after dwell.
 *
 * Props:
 *   label        — text label
 *   onGazeSelect — callback when dwell completes
 *   children     — optional inner content (overrides label)
 *   dwellMs      — dwell duration (default 1000)
 *   className    — extra CSS class
 *   style        — extra inline styles
 *   onClick      — fallback click handler (accessibility)
 */
export default function GazeButton({
  label,
  onGazeSelect,
  children,
  dwellMs = 1000,
  className = "",
  style = {},
  onClick,
}) {
  const ref = useRef(null);
  const { dwelling, pct } = useDwellTime(ref, dwellMs, onGazeSelect);

  const ringBg = dwelling
    ? `conic-gradient(#00e5ff ${pct}%, transparent ${pct}%)`
    : "transparent";

  return (
    <div
      ref={ref}
      className={className}
      onClick={onClick}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transform: dwelling ? "scale(1.05)" : "scale(1)",
        transition: "transform 0.1s, box-shadow 0.1s",
        ...style,
      }}
    >
      {/* Dwell progress ring */}
      {dwelling && (
        <div style={{
          position: "absolute",
          inset: -8, borderRadius: 32,
          background: `conic-gradient(#00e5ff ${pct}%, #1e293b ${pct}%)`,
          zIndex: -1, pointerEvents: "none",
        }}>
          <div style={{ position: "absolute", inset: 4, borderRadius: 26, background: "inherit" }} />
        </div>
      )}
      {children ?? label}
    </div>
  );
}
