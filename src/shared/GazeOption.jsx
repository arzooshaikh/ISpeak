import React, { useRef, useEffect, useId } from "react";
import { useDwellTime }  from "../gaze/useDwellTime";
import { gazeRegistry }  from "../gaze/gazeRegistry";

export default function GazeOption({
  label, emoji, sublabel,
  color = "#6366f1", glow,
  onSelect, dwellMs = 1000,
  selected = false, disabled = false,
}) {
  const ref       = useRef(null);
  const id        = useId();
  const { dwelling, pct } = useDwellTime(ref, dwellMs, disabled ? null : onSelect);
  const glowColor = glow || color;

  // Register this button in the global gaze registry so snapping works
  useEffect(() => {
    if (ref.current) gazeRegistry.register(id, ref.current);
    return () => gazeRegistry.unregister(id);
  }, [id]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Dwell ring outside the box so it's never clipped */}
      {dwelling && (
        <div style={{
          position: "absolute", inset: -6, borderRadius: 30,
          background: `conic-gradient(${glowColor} ${pct}%, #334155 ${pct}%)`,
          pointerEvents: "none", zIndex: 0,
        }}>
          <div style={{
            position: "absolute", inset: 5, borderRadius: 24,
            background: selected ? color : `${color}33`,
          }} />
        </div>
      )}

      {/* Main box */}
      <div
        ref={ref}
        onClick={disabled ? undefined : onSelect}
        style={{
          position: "relative", zIndex: 1,
          width: 180, height: 180, borderRadius: 24,
          background: selected ? color : dwelling ? `${color}22` : "#1e293b",
          border: `3px solid ${selected ? color : dwelling ? color : "#334155"}`,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
          cursor: disabled ? "default" : "pointer",
          userSelect: "none",
          boxShadow: selected
            ? `0 0 32px 8px ${glowColor}88`
            : dwelling
            ? `0 0 24px 6px ${glowColor}66`
            : "0 4px 16px rgba(0,0,0,0.3)",
          transform: dwelling ? "scale(1.05)" : selected ? "scale(1.03)" : "scale(1)",
          transition: "all 0.15s ease",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {emoji && <span style={{ fontSize: 42 }}>{emoji}</span>}
        <span style={{
          fontSize: 18, fontWeight: 700,
          color: selected || dwelling ? "#fff" : "#e2e8f0",
          textAlign: "center", lineHeight: 1.2,
        }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontSize: 12, color: selected ? "#ffffffaa" : "#64748b", textAlign: "center" }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
