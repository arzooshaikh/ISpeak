import React from "react";
import SOSButton from "./SOSButton";

/**
 * PatientScreen — dark full-screen wrapper for all patient-facing screens.
 * Shows step indicator, title, subtitle, and always-visible SOS button.
 */
export default function PatientScreen({
  step, totalSteps, title, subtitle,
  children, patientId, onBack,
}) {
  return (
    <div style={{
      background: "#0f172a",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "system-ui, sans-serif",
      color: "#f8fafc",
      paddingBottom: 40,
    }}>
      {/* Step bar */}
      {totalSteps && (
        <div style={{
          width: "100%",
          display: "flex",
          gap: 4,
          padding: "16px 24px 0",
          boxSizing: "border-box",
        }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 99,
              background: i < step ? "#6366f1" : "#1e293b",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
      )}

      {/* Back button */}
      {onBack && (
        <button onClick={onBack} style={{
          position: "absolute", top: 20, left: 20,
          background: "transparent", border: "none",
          color: "#64748b", fontSize: 24, cursor: "pointer", padding: 4,
        }}>←</button>
      )}

      {/* SOS always visible */}
      <SOSButton patientId={patientId} />

      {/* Header */}
      <div style={{ textAlign: "center", padding: "36px 24px 32px", maxWidth: 700 }}>
        <div style={{ fontSize: 13, color: "#6366f1", fontWeight: 600, marginBottom: 8, letterSpacing: 1 }}>
          {step && totalSteps ? `STEP ${step} OF ${totalSteps}` : "ISPEAK"}
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px", color: "#f8fafc" }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>{subtitle}</p>
        )}
      </div>

      {/* Content */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}
