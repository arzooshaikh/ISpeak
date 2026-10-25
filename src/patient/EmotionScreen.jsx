import React from "react";
import PatientScreen from "../shared/PatientScreen";
import GazeOption from "../shared/GazeOption";

const EMOTIONS = [
  { id: "happy",   label: "Happy",   emoji: "😊", color: "#16a34a", glow: "#22c55e" },
  { id: "neutral", label: "Neutral", emoji: "😐", color: "#d97706", glow: "#fbbf24" },
  { id: "pain",    label: "Pain",    emoji: "😣", color: "#dc2626", glow: "#f87171" },
];

export default function EmotionScreen({ patientId, onSelect }) {
  return (
    <PatientScreen
      step={1} totalSteps={4}
      title="How are you feeling?"
      subtitle="Look at your answer for 1 second to select it"
      patientId={patientId}
    >
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", justifyContent: "center" }}>
        {EMOTIONS.map(e => (
          <GazeOption
            key={e.id}
            label={e.label}
            emoji={e.emoji}
            color={e.color}
            glow={e.glow}
            onSelect={() => onSelect(e.id)}
          />
        ))}
      </div>
    </PatientScreen>
  );
}
