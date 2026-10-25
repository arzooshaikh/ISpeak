import React from "react";
import PatientScreen from "../shared/PatientScreen";
import GazeOption from "../shared/GazeOption";

const PAIN_TYPES = [
  { id: "sharp",        label: "Sharp",        emoji: "⚡", sublabel: "Stabbing, acute"       },
  { id: "burning",      label: "Burning",      emoji: "🔥", sublabel: "Hot, stinging"          },
  { id: "pressure",     label: "Pressure",     emoji: "⬇️", sublabel: "Heavy, squeezing"       },
  { id: "throbbing",    label: "Throbbing",    emoji: "💓", sublabel: "Pulsing, pounding"      },
  { id: "numb",         label: "Numb",         emoji: "❄️", sublabel: "No feeling, tingling"   },
  { id: "cant_describe",label: "Can't Say",    emoji: "❓", sublabel: "Hard to describe"       },
];

export default function PainTypeScreen({ patientId, onSelect, onBack }) {
  return (
    <PatientScreen
      step={4} totalSteps={4}
      title="What type of pain?"
      subtitle="Look at the best description for 1 second"
      patientId={patientId}
      onBack={onBack}
    >
      <div style={{
        display: "flex", gap: 20,
        flexWrap: "wrap", justifyContent: "center",
        maxWidth: 700, padding: "0 24px",
      }}>
        {PAIN_TYPES.map(p => (
          <GazeOption
            key={p.id}
            label={p.label}
            emoji={p.emoji}
            sublabel={p.sublabel}
            color="#7c3aed"
            glow="#a78bfa"
            onSelect={() => onSelect(p.id)}
            dwellMs={1000}
          />
        ))}
      </div>
    </PatientScreen>
  );
}
