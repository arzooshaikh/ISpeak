import React from "react";
import PatientScreen from "../shared/PatientScreen";
import GazeOption from "../shared/GazeOption";

const LEVELS = [
  { id: 1, label: "Very Mild",  emoji: "😌", color: "#15803d", sublabel: "Barely noticeable" },
  { id: 2, label: "Mild",       emoji: "🙂", color: "#16a34a", sublabel: "Uncomfortable"     },
  { id: 3, label: "Moderate",   emoji: "😟", color: "#d97706", sublabel: "Distracting"        },
  { id: 4, label: "Severe",     emoji: "😣", color: "#ea580c", sublabel: "Hard to ignore"     },
  { id: 5, label: "Unbearable", emoji: "😱", color: "#dc2626", sublabel: "Worst pain"         },
];

export default function SeverityScreen({ patientId, onSelect, onBack }) {
  return (
    <PatientScreen
      step={3} totalSteps={4}
      title="How bad is the pain?"
      subtitle="1 = very mild, 5 = unbearable"
      patientId={patientId}
      onBack={onBack}
    >
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {LEVELS.map(l => (
          <GazeOption
            key={l.id}
            label={l.label}
            emoji={l.emoji}
            sublabel={l.sublabel}
            color={l.color}
            onSelect={() => onSelect(l.id)}
            dwellMs={1000}
          />
        ))}
      </div>
    </PatientScreen>
  );
}
