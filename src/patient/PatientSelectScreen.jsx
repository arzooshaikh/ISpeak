import React, { useState, useEffect } from "react";
import { getPatients } from "../shared/api";

const ALERT_COLOR = { red: "#f87171", amber: "#fbbf24", green: "#4ade80" };
const ALERT_BG    = { red: "#450a0a", amber: "#431407", green: "#14532d" };

function timeAgo(iso) {
  if (!iso) return "Never";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * PatientSelectScreen
 * Caregiver selects the patient from a list before starting a gaze session.
 * Props: onSelect(patient), onNurseDashboard
 */
export default function PatientSelectScreen({ onSelect, onNurseDashboard }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getPatients()
      .then(data => { setPatients(data || []); setLoading(false); })
      .catch(e  => { setError("Could not load patients. Is the backend running?"); setLoading(false); });
  }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    String(p.roomNumber).includes(search)
  );

  // Sort: red first, then amber, then green
  const sorted = [...filtered].sort((a, b) => {
    const o = { red: 0, amber: 1, green: 2 };
    return (o[a.alertStatus] ?? 3) - (o[b.alertStatus] ?? 3);
  });

  return (
    <div style={{
      background: "#0f172a", minHeight: "100vh",
      fontFamily: "system-ui, sans-serif", color: "#f8fafc",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "28px 32px 0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>👁</span>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>ISpeak</h1>
          </div>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
            Select a patient to begin their gaze session
          </p>
        </div>
        <button
          onClick={onNurseDashboard}
          style={{
            background: "#1e293b", color: "#94a3b8",
            border: "1px solid #334155", borderRadius: 8,
            padding: "8px 18px", fontSize: 13, cursor: "pointer",
          }}
        >
          Nurse Dashboard →
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "20px 32px 0" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or room number..."
          style={{
            width: "100%", boxSizing: "border-box",
            background: "#1e293b", border: "1px solid #334155",
            borderRadius: 10, padding: "12px 16px",
            color: "#f8fafc", fontSize: 15, outline: "none",
          }}
        />
      </div>

      {/* Patient list */}
      <div style={{ flex: 1, padding: "16px 32px", overflowY: "auto" }}>
        {loading && (
          <div style={{ color: "#64748b", textAlign: "center", padding: 40 }}>
            Loading patients...
          </div>
        )}
        {error && (
          <div style={{
            background: "#1e293b", borderRadius: 12, padding: 24,
            color: "#94a3b8", textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ marginBottom: 8 }}>{error}</div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              You can still test the gaze UI — enter a patient ID manually below.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
              <input
                type="number" placeholder="Patient ID"
                id="manual-id"
                style={{
                  background: "#0f172a", border: "1px solid #334155",
                  borderRadius: 8, padding: "8px 12px",
                  color: "#f8fafc", fontSize: 14, outline: "none", width: 120,
                }}
              />
              <button
                onClick={() => {
                  const id = parseInt(document.getElementById("manual-id").value);
                  if (id) onSelect({ id, name: `Patient #${id}`, roomNumber: "—", alertStatus: "green" });
                }}
                style={{
                  background: "#6366f1", color: "#fff", border: "none",
                  borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer",
                }}
              >
                Start →
              </button>
            </div>
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div style={{ color: "#475569", textAlign: "center", padding: 40 }}>
            No patients found
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 680, margin: "0 auto" }}>
          {sorted.map(p => (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              style={{
                background: selected?.id === p.id ? "#1e3a5f" : "#1e293b",
                border: `2px solid ${selected?.id === p.id ? "#6366f1" : "#334155"}`,
                borderRadius: 14, padding: "18px 22px",
                cursor: "pointer", display: "flex",
                alignItems: "center", gap: 16,
                transition: "all 0.15s",
              }}
            >
              {/* Alert dot */}
              <div style={{
                width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                background: ALERT_COLOR[p.alertStatus] || "#64748b",
                boxShadow: p.alertStatus === "red" ? `0 0 8px 3px #dc262688` : "none",
              }} />

              {/* Patient info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#f8fafc", marginBottom: 3 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  Room {p.roomNumber}
                  {p.diagnosis && ` • ${p.diagnosis}`}
                  <span style={{ marginLeft: 12 }}>
                    Last report: {timeAgo(p.lastReportTimestamp)}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {p.hasActiveAnomaly && (
                  <span style={{
                    background: ALERT_BG.red, color: ALERT_COLOR.red,
                    fontSize: 11, fontWeight: 700, padding: "3px 10px",
                    borderRadius: 99, letterSpacing: 0.5,
                  }}>ANOMALY</span>
                )}
                {p.hasUnreadReport && !p.hasActiveAnomaly && (
                  <span style={{
                    background: "#1e3a5f", color: "#60a5fa",
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                  }}>NEW REPORT</span>
                )}
                <span style={{
                  background: ALERT_BG[p.alertStatus],
                  color: ALERT_COLOR[p.alertStatus],
                  fontSize: 11, fontWeight: 700, padding: "3px 10px",
                  borderRadius: 99, textTransform: "uppercase",
                }}>
                  {p.alertStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start button — sticky bottom */}
      {selected && (
        <div style={{
          position: "sticky", bottom: 0,
          background: "linear-gradient(transparent, #0f172a 40%)",
          padding: "24px 32px",
        }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{
              background: "#1e293b", borderRadius: 14,
              padding: "16px 24px", display: "flex",
              alignItems: "center", justifyContent: "space-between",
              border: "1px solid #6366f1",
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Room {selected.roomNumber}</div>
              </div>
              <button
                onClick={() => onSelect(selected)}
                style={{
                  background: "#6366f1", color: "#fff",
                  border: "none", borderRadius: 10,
                  padding: "12px 28px", fontSize: 15,
                  fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 0 20px 4px #6366f188",
                }}
              >
                Start Session →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
