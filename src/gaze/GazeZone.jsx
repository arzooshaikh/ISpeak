import React, { useRef, useEffect, useCallback } from "react";
import { useDwellTime } from "./useDwellTime";

/**
 * GazeZone — wraps any element to make it gaze-interactive.
 *
 * Props:
 *   zoneId       — unique id string
 *   label        — accessible label
 *   onGazeEnter  — fires when gaze enters the zone
 *   onGazeSelect — fires after dwell completes
 *   dwellMs      — dwell duration (default 1000)
 *   children     — wrapped content
 *   style        — extra inline styles
 */
export default function GazeZone({
  zoneId,
  label,
  onGazeEnter,
  onGazeSelect,
  dwellMs = 1000,
  children,
  style = {},
}) {
  const ref = useRef(null);
  const { dwelling, pct } = useDwellTime(ref, dwellMs, onGazeSelect);

  // Fire onGazeEnter when dwelling starts
  const prevDwellingRef = useRef(false);
  useEffect(() => {
    if (dwelling && !prevDwellingRef.current) onGazeEnter?.();
    prevDwellingRef.current = dwelling;
  }, [dwelling, onGazeEnter]);

  return (
    <div
      ref={ref}
      aria-label={label}
      data-zone-id={zoneId}
      style={{
        position: "relative",
        outline: dwelling ? "3px solid #00e5ff" : "3px solid transparent",
        transition: "outline 0.1s",
        ...style,
      }}
    >
      {/* Dwell progress bar along bottom edge */}
      {dwelling && (
        <div
          style={{
            position: "absolute",
            bottom: 0, left: 0,
            height: "4px",
            width: `${pct}%`,
            background: "#00e5ff",
            borderRadius: "0 0 4px 4px",
            transition: "width 0.05s",
            pointerEvents: "none",
          }}
        />
      )}
      {children}
    </div>
  );
}
