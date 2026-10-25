import React from "react";
import PatientScreen from "../shared/PatientScreen";
import GazeOption from "../shared/GazeOption";

const BODY_PARTS = [
  { id: "head",      label: "Head",      emoji: "🧠" },
  { id: "neck",      label: "Neck",      emoji: "🦒" },
  { id: "chest",     label: "Chest",     emoji: "💗" },
  { id: "stomach",   label: "Stomach",   emoji: "🫃" },
  { id: "back",      label: "Back",      emoji: "🔙" },
  { id: "left_arm",  label: "Left Arm",  emoji: "💪" },
  { id: "right_arm", label: "Right Arm", emoji: "💪" },
  { id: "left_leg",  label: "Left Leg",  emoji: "🦵" },
  { id: "right_leg", label: "Right Leg", emoji: "🦵" },
];

export default function BodyPartScreen({ patientId, onSelect, onBack }) {
  return (
    <PatientScreen
      step={2} totalSteps={4}
      title="Where does it hurt?"
      subtitle="Look at the body part for 1 second"
      patientId={patientId}
      onBack={onBack}
    >
      <div style={{
        display: "flex", gap: 20,
        flexWrap: "wrap", justifyContent: "center",
        maxWidth: 700, padding: "0 24px",
      }}>
        {BODY_PARTS.map(b => (
          <GazeOption
            key={b.id}
            label={b.label}
            emoji={b.emoji}
            color="#6366f1"
            glow="#818cf8"
            onSelect={() => onSelect(b.id)}
            dwellMs={1000}
          />
        ))}
      </div>
    </PatientScreen>
  );
}
