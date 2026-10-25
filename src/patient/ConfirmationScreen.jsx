import React, { useEffect, useState } from "react";
import PatientScreen from "../shared/PatientScreen";
import GazeOption from "../shared/GazeOption";
import { createReport } from "../shared/api";

const EMOTION_LABELS  = { happy: "😊 Happy", neutral: "😐 Neutral", pain: "😣 Pain" };
const BODY_LABELS     = {
  head: "Head", neck: "Neck", chest: "Chest", stomach: "Stomach",
  back: "Back", left_arm: "Left Arm", right_arm: "Right Arm",
  left_leg: "Left Leg", right_leg: "Right Leg",
};
const PAIN_LABELS     = {
  sharp: "⚡ Sharp", burning: "🔥 Burning", pressure: "⬇️ Pressure",
  throbbing: "💓 Throbbing", numb: "❄️ Numb", cant_describe: "❓ Can't say",
};

export default function ConfirmationScreen({ patientId, selections, onConfirm, onBack }) {
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error
  const [clinicalNote, setClinicalNote] = useState("");

  async function submit() {
    if (status !== "idle") return;
    setStatus("submitting");
    try {
      const report = await createReport({
        patientId,
        emotion:   selections.emotion,
        bodyPart:  selections.bodyPart,
        severity:  selections.severity,
        painType:  selections.painType,
      });
      setClinicalNote(report.clinicalNote || "");
      setStatus("done");
      setTimeout(() => onConfirm(report), 3000);
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  const rows = [
    { label: "Feeling",   value: EMOTION_LABELS[selections.emotion]  || selections.emotion  },
    { label: "Location",  value: BODY_LABELS[selections.bodyPart]     || selections.bodyPart },
    { label: "Severity",  value: `${selections.severity} / 5`                               },
    { label: "Pain type", value: PAIN_LABELS[selections.painType]     || selections.painType },
  ];

  if (status === "done") {
    return (
      <div style={{
        background: "#0f172a", minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "system-ui, sans-serif", color: "#f8fafc",
        textAlign: "center", padding: 40,
      }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>✅</div>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Report Sent</h1>
        <p style={{ color: "#64748b", fontSize: 15 }}>Your nurse has been notified.</p>
        {clinicalNote && (
          <div style={{
            marginTop: 32, background: "#1e293b", borderRadius: 12,
            padding: "16px 24px", maxWidth: 480, textAlign: "left",
          }}>
            <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
              CLINICAL NOTE
            </div>
            <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{clinicalNote}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <PatientScreen
      title="Does this look right?"
      subtitle="Look at Confirm to submit, or go back to change anything"
      patientId={patientId}
      onBack={onBack}
    >
      {/* Summary card */}
      <div style={{
        background: "#1e293b", borderRadius: 16,
        padding: "24px 32px", marginBottom: 40,
        minWidth: 320, maxWidth: 480, width: "90%",
      }}>
        {rows.map(r => (
          <div key={r.label} style={{
            display: "flex", justifyContent: "space-between",
            padding: "10px 0",
            borderBottom: "1px solid #334155",
          }}>
            <span style={{ color: "#64748b", fontSize: 14 }}>{r.label}</span>
            <span style={{ color: "#f8fafc", fontWeight: 600, fontSize: 15 }}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Confirm / Back */}
      <div style={{ display: "flex", gap: 24 }}>
        <GazeOption
          label="Go Back"
          emoji="←"
          color="#475569"
          onSelect={onBack}
          dwellMs={1000}
        />
        <GazeOption
          label={status === "submitting" ? "Sending..." : "Confirm ✓"}
          emoji={status === "error" ? "⚠️" : "✅"}
          sublabel={status === "error" ? "Tap to retry" : "Sends to nurse"}
          color="#16a34a"
          glow="#4ade80"
          onSelect={submit}
          dwellMs={1000}
          disabled={status === "submitting"}
        />
      </div>

      {status === "error" && (
        <p style={{ color: "#f87171", marginTop: 16, fontSize: 14 }}>
          Could not send report. Please try again.
        </p>
      )}
    </PatientScreen>
  );
}
