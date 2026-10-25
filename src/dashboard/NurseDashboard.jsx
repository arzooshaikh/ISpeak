import React, { useState, useEffect, useCallback } from "react";
import {
  getPatients, getReports, getSOSAlerts,
  acknowledgeAlert, getPatientTrends,
  connectDashboardWS, isLoggedIn, logout, createPatient,
  deletePatient,
} from "../shared/api";

// ── Helpers ──────────────────────────────────────────────────────────────────
const ALERT_COLOR = { red: "#dc2626", amber: "#d97706", green: "#16a34a" };
const ALERT_BG = { red: "#fef2f2", amber: "#fffbeb", green: "#f0fdf4" };

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function getPatientCheckinsCount(patientId) {
  try {
    const reports = JSON.parse(localStorage.getItem("ispeak_mock_reports") || "[]");
    const todayStr = new Date().toDateString();
    const pId = parseInt(patientId);
    return reports.filter(r => r.patientId === pId && new Date(r.timestamp).toDateString() === todayStr).length;
  } catch (_) {
    return 0;
  }
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function AlertBadge({ status }) {
  return (
    <span style={{
      display: "inline-block", width: 10, height: 10, borderRadius: "50%",
      background: ALERT_COLOR[status] || "#64748b",
      boxShadow: status === "red" ? `0 0 8px 2px ${ALERT_COLOR.red}40` : "none",
      flexShrink: 0,
    }} />
  );
}

function PatientCard({ patient, onSelect, selected }) {
  const checkinsCount = getPatientCheckinsCount(patient.id);

  return (
    <div
      onClick={() => onSelect(patient)}
      style={{
        background: selected ? "#e6eae5" : "#ffffff",
        border: `1px solid ${selected ? "#5b705f" : ALERT_COLOR[patient.alertStatus] === "#dc2626" ? "#fca5a5" : "#dce2dc"}`,
        borderRadius: 12, padding: "14px 18px",
        cursor: "pointer", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
        transition: "all 0.15s ease",
      }}
    >
      <AlertBadge status={patient.alertStatus} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: "#2b352c", fontSize: 15 }}>{patient.name}</div>
        <div style={{ fontSize: 12, color: "#6a776c", marginTop: 2 }}>
          Room {patient.roomNumber} • Last report: {timeAgo(patient.lastReportTimestamp)}
        </div>

        {/* Compliance tracker on Card */}
        <div style={{ display: "flex", gap: 6, marginTop: 6, fontSize: 12 }}>
          <span style={{ opacity: checkinsCount >= 1 ? 1 : 0.25, filter: checkinsCount >= 1 ? "none" : "grayscale(100%)", transition: "opacity 0.2s" }} title="Morning check-in">☀️</span>
          <span style={{ opacity: checkinsCount >= 2 ? 1 : 0.25, filter: checkinsCount >= 2 ? "none" : "grayscale(100%)", transition: "opacity 0.2s" }} title="Afternoon check-in">🌤️</span>
          <span style={{ opacity: checkinsCount >= 3 ? 1 : 0.25, filter: checkinsCount >= 3 ? "none" : "grayscale(100%)", transition: "opacity 0.2s" }} title="Evening check-in">🌙</span>
        </div>
      </div>

      {patient.hasActiveAnomaly && (
        <span style={{
          background: "#fee2e2", color: "#dc2626",
          border: "1px solid #fca5a5",
          fontSize: 10, fontWeight: 700, padding: "2px 6px",
          borderRadius: 99, letterSpacing: 0.5,
        }}>ANOMALY</span>
      )}
      {patient.hasUnreadReport && !patient.hasActiveAnomaly && (
        <span style={{
          background: "#e0f2fe", color: "#0284c7",
          fontSize: 10, fontWeight: 700, padding: "2px 6px",
          borderRadius: 99,
        }}>NEW</span>
      )}
    </div>
  );
}

function SOSPanel({ alerts, onAcknowledge }) {
  if (!alerts.length) return null;
  return (
    <div style={{
      background: "#fef2f2", border: "1px solid #fca5a5",
      borderRadius: 12, padding: "16px 20px", marginBottom: 20,
      boxShadow: "0 4px 6px rgba(220, 38, 38, 0.05)",
    }}>
      <div style={{ color: "#dc2626", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        🚨 Active SOS Alerts ({alerts.length})
      </div>
      {alerts.map(a => (
        <div key={a.id} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 0", borderBottom: "1px solid #fee2e2",
        }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: "#2b352c", fontWeight: 600 }}>{a.patientName || `Patient #${a.patientId}`}</span>
            <span style={{ color: "#6a776c", fontSize: 12, marginLeft: 8 }}>{timeAgo(a.timestamp)}</span>
          </div>
          <button
            onClick={() => onAcknowledge(a.id)}
            style={{
              background: "#7c9082", color: "#fff",
              border: "none", borderRadius: 6,
              padding: "4px 12px", fontSize: 12,
              cursor: "pointer", fontWeight: 600,
              boxShadow: "0 2px 4px rgba(124, 144, 130, 0.2)",
              transition: "background 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.background = "#5b705f"}
            onMouseOut={(e) => e.currentTarget.style.background = "#7c9082"}
          >
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}

function ReportRow({ report }) {
  const EMOTION_EMOJI = { happy: "😊", neutral: "😐", pain: "😣" };
  return (
    <div style={{
      background: "#ffffff", borderRadius: 12,
      padding: "16px 20px", marginBottom: 12,
      border: "1px solid #dce2dc",
      borderLeft: `5px solid ${report.isAnomaly ? "#dc2626" : "#5b705f"}`,
      boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: "#2b352c", fontWeight: 600, fontSize: 15 }}>
          {EMOTION_EMOJI[report.emotion]} {report.emotion} — {report.bodyPart?.replace("_", " ")}
        </span>
        <span style={{ fontSize: 12, color: "#6a776c" }}>{timeAgo(report.timestamp)}</span>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6a776c" }}>
        <span>Severity: <strong style={{ color: report.severity >= 4 ? "#dc2626" : "#2b352c" }}>{report.severity}/5</strong></span>
        <span>Pain Quality: {report.painType?.replace("_", " ")}</span>
        {report.isAnomaly && <span style={{ color: "#dc2626", fontWeight: 600 }}>⚠ Anomaly Alert</span>}
      </div>
      {report.clinicalNote && (
        <div style={{
          marginTop: 12, padding: "10px 14px",
          background: "#f4f7f3", borderRadius: 8,
          fontSize: 12, color: "#6a776c", lineHeight: 1.6,
          border: "1px solid #dce2dc",
        }}>
          <span style={{ color: "#5b705f", fontWeight: 700 }}>Clinical Note: </span>
          {report.clinicalNote}
        </div>
      )}
    </div>
  );
}

function TrendsChart({ trends }) {
  if (!trends.length) return <div style={{ color: "#6a776c", fontSize: 14 }}>No trend data</div>;

  const maxSeverity = 5;
  const barW = Math.max(20, Math.min(40, 400 / trends.length));

  return (
    <div>
      <div style={{ fontSize: 12, color: "#6a776c", marginBottom: 12 }}>Severity rating over the last 30 days</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, borderBottom: "2px solid #e5e7eb", paddingBottom: 6 }}>
        {trends.map((t, i) => (
          <div key={i} title={`${t.date}: ${t.bodyPart} severity ${t.severity}`} style={{
            flex: "0 0 auto",
            width: barW,
            height: `${(t.severity / maxSeverity) * 100}%`,
            background: t.severity >= 4 ? "#dc2626" : t.severity === 3 ? "#d97706" : "#5b705f",
            borderRadius: "4px 4px 0 0",
            opacity: 0.9,
            transition: "height 0.3s ease",
          }} />
        ))}
      </div>
    </div>
  );
}

function PatientDetail({ patient, reports, trends, loading, onDelete }) {
  if (!patient) return (
    <div style={{ color: "#6a776c", textAlign: "center", padding: 80, fontSize: 15 }}>
      👁️ Select a patient from the roster to view their real-time eye logs and compliance status.
    </div>
  );

  const checkinsCount = getPatientCheckinsCount(patient.id);

  return (
    <div>
      {/* Patient header */}
      <div style={{
        background: "#ffffff", borderRadius: 16,
        padding: "24px 28px", marginBottom: 24,
        display: "flex", alignItems: "center", gap: 16,
        border: "1px solid #dce2dc",
        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      }}>
        <AlertBadge status={patient.alertStatus} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: "#2b352c", fontSize: 24, fontWeight: 700 }}>{patient.name}</h2>
          <div style={{ color: "#6a776c", fontSize: 14, marginTop: 4 }}>
            Room <strong>{patient.roomNumber}</strong>
            {patient.diagnosis && ` • ${patient.diagnosis}`}
          </div>
        </div>

        {/* Delete Record Button */}
        <button
          onClick={() => onDelete(patient.id, patient.name)}
          style={{
            background: "#ffffff",
            color: "#dc2626",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 600,
            transition: "all 0.2s",
            marginRight: 8,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#fee2e2";
            e.currentTarget.style.borderColor = "#dc2626";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#ffffff";
            e.currentTarget.style.borderColor = "#fca5a5";
          }}
        >
          🗑️ Delete Record
        </button>

        <div style={{
          background: ALERT_BG[patient.alertStatus],
          color: ALERT_COLOR[patient.alertStatus],
          border: `1px solid ${ALERT_COLOR[patient.alertStatus]}40`,
          padding: "6px 14px", borderRadius: 99,
          fontSize: 12, fontWeight: 700, textTransform: "uppercase",
        }}>
          {patient.alertStatus} status
        </div>
      </div>

      {/* 3x Daily Compliance Status Dashboard Section */}
      <div style={{
        background: "#ffffff", borderRadius: 16,
        padding: "20px 24px", marginBottom: 24,
        border: "1px solid #dce2dc",
        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      }}>
        <h3 style={{ margin: "0 0 14px 0", color: "#2b352c", fontSize: 16, fontWeight: 700 }}>
          📅 3x-Daily Check-in Compliance Tracker
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div style={{
            background: checkinsCount >= 1 ? "#f0fdf4" : "#f9fafb",
            border: `1px solid ${checkinsCount >= 1 ? "#bbf7d0" : "#e5e7eb"}`,
            borderRadius: 12, padding: "14px", textAlign: "center",
          }}>
            <span style={{ fontSize: 24, display: "block", marginBottom: 4 }}>☀️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: checkinsCount >= 1 ? "#15803d" : "#9ca3af" }}>
              Morning Check
            </span>
            <span style={{ fontSize: 11, display: "block", color: "#6a776c", marginTop: 2 }}>
              {checkinsCount >= 1 ? "✅ Complete" : "⏳ Missed / Pending"}
            </span>
          </div>

          <div style={{
            background: checkinsCount >= 2 ? "#f0fdf4" : "#f9fafb",
            border: `1px solid ${checkinsCount >= 2 ? "#bbf7d0" : "#e5e7eb"}`,
            borderRadius: 12, padding: "14px", textAlign: "center",
          }}>
            <span style={{ fontSize: 24, display: "block", marginBottom: 4 }}>🌤️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: checkinsCount >= 2 ? "#15803d" : "#9ca3af" }}>
              Afternoon Check
            </span>
            <span style={{ fontSize: 11, display: "block", color: "#6a776c", marginTop: 2 }}>
              {checkinsCount >= 2 ? "✅ Complete" : "⏳ Missed / Pending"}
            </span>
          </div>

          <div style={{
            background: checkinsCount >= 3 ? "#f0fdf4" : "#f9fafb",
            border: `1px solid ${checkinsCount >= 3 ? "#bbf7d0" : "#e5e7eb"}`,
            borderRadius: 12, padding: "14px", textAlign: "center",
          }}>
            <span style={{ fontSize: 24, display: "block", marginBottom: 4 }}>🌙</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: checkinsCount >= 3 ? "#15803d" : "#9ca3af" }}>
              Evening Check
            </span>
            <span style={{ fontSize: 11, display: "block", color: "#6a776c", marginTop: 2 }}>
              {checkinsCount >= 3 ? "✅ Complete" : "⏳ Missed / Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Trends */}
      {trends.length > 0 && (
        <div style={{
          background: "#ffffff", borderRadius: 16,
          padding: "20px 24px", marginBottom: 24,
          border: "1px solid #dce2dc",
          boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
        }}>
          <h3 style={{ margin: "0 0 12px 0", color: "#2b352c", fontSize: 16, fontWeight: 700 }}>
            📈 Patient Severity Trends
          </h3>
          <TrendsChart trends={trends} />
        </div>
      )}

      {/* Reports list */}
      <div style={{ fontSize: 14, color: "#6a776c", marginBottom: 12, fontWeight: 600 }}>
        {loading ? "Syncing eye logs..." : `📑 Logged Reports (${reports.length})`}
      </div>
      {reports.map(r => <ReportRow key={r.id} report={r} />)}
      {!loading && !reports.length && (
        <div style={{ color: "#6a776c", fontSize: 14, padding: 20, textAlign: "center", background: "#ffffff", borderRadius: 12, border: "1px solid #dce2dc" }}>
          No reports logged yet for this patient.
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function NurseDashboard() {
  const [patients, setPatients] = useState([]);
  const [sosAlerts, setSOSAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reports, setReports] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting");

  // Load initial data
  useEffect(() => {
    getPatients().then(setPatients).catch(console.error);
    getSOSAlerts().then(setSOSAlerts).catch(console.error);
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    const ws = connectDashboardWS((msg) => {
      setWsStatus("connected");
      if (msg.type === "sosAlert") {
        setSOSAlerts(prev => [msg, ...prev]);
      }
      if (msg.type === "newReport") {
        // Refresh patient list to update alert status
        getPatients().then(setPatients).catch(console.error);
        // Refresh reports if this patient is selected
        setSelected(sel => {
          if (sel?.id === msg.patientId) {
            getReports(msg.patientId).then(setReports).catch(console.error);
          }
          return sel;
        });
      }
      if (msg.type === "checkinPrompt") {
        console.log("[Checkin prompt]", msg);
      }
    });

    ws.onopen = () => setWsStatus("connected");
    ws.onclose = () => setWsStatus("disconnected");

    return () => ws.close();
  }, []);

  // Load reports + trends when patient selected
  async function selectPatient(p) {
    setSelected(p);
    setReports([]);
    setTrends([]);
    setLoadingReports(true);
    try {
      const [r, t] = await Promise.all([
        getReports(p.id),
        getPatientTrends(p.id),
      ]);
      setReports(r || []);
      setTrends((t?.trends) || []);
    } catch (e) { console.error(e); }
    finally { setLoadingReports(false); }
  }

  async function handleDeletePatient(id, name) {
    if (!window.confirm(`Are you sure you want to permanently delete the patient record for "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deletePatient(id);
      setSelected(null);
      const updated = await getPatients();
      setPatients(updated);
    } catch (e) {
      alert(`Failed to delete patient: ${e.message}`);
    }
  }

  async function handleAcknowledge(id) {
    await acknowledgeAlert(id).catch(console.error);
    setSOSAlerts(prev => prev.filter(a => a.id !== id));
  }

  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({ patient_id: "", name: "", room_number: "", condition: "", age: "", password: "" });
  const [adding, setAdding] = useState(false);

  async function handleAddPatient() {
    if (!newPatient.name || !newPatient.room_number) {
      alert("Name and Room Number are required.");
      return;
    }
    setAdding(true);
    try {
      const birthYear = new Date().getFullYear() - (parseInt(newPatient.age) || 30);

      await createPatient({
        ...newPatient,

        patient_id: newPatient.patient_id,

        age: parseInt(newPatient.age) || 30,

        password: newPatient.password || "12345",

        date_of_birth: `${birthYear}-01-01`

      });
      const updated = await getPatients();
      setPatients(updated);
      setShowAddPatient(false);
      setNewPatient({ patient_id: "", name: "", room_number: "", condition: "", age: "", password: "" });
    } catch (e) { alert(e.message); }
    finally { setAdding(false); }
  }

  const redCount = patients.filter(p => p.alertStatus === "red").length;
  const amberCount = patients.filter(p => p.alertStatus === "amber").length;

  const inputStyle = {
    width: "100%", padding: "10px 12px", background: "#ffffff",
    border: "1px solid #dce2dc", borderRadius: 8, color: "#2b352c",
    fontSize: 14, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      background: "#f4f7f3", minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "#2b352c",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{
        background: "#ffffff", borderBottom: "1px solid #dce2dc",
        padding: "16px 32px", display: "flex", alignItems: "center", gap: 24,
        boxShadow: "0 2px 10px rgba(0,0,0,0.01)",
      }}>
        <span style={{ color: "#5b705f", fontWeight: 800, fontSize: 22, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 8 }}>
          👁️ ISpeak
        </span>
        <span style={{ color: "#dce2dc" }}>|</span>
        <span style={{ color: "#6a776c", fontSize: 15, fontWeight: 500 }}>Clinician Portal</span>

        <div style={{ display: "flex", gap: 12, marginLeft: 16 }}>
          {redCount > 0 && (
            <span style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
              {redCount} Critical Alert{redCount !== 1 ? "s" : ""}
            </span>
          )}
          {amberCount > 0 && (
            <span style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
              {amberCount} Moderate
            </span>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: wsStatus === "connected" ? "#7c9082" : "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: wsStatus === "connected" ? "#7c9082" : "#dc2626" }} />
            {wsStatus === "connected" ? "Live Connected" : "Local Sync Mode"}
          </span>
          <button onClick={() => { logout(); window.location.hash = "#doctor/login"; }} style={{
            background: "#ffffff", color: "#6a776c",
            border: "1px solid #dce2dc", borderRadius: 8,
            padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600,
            transition: "all 0.2s",
          }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#f4f7f3"; e.currentTarget.style.borderColor = "#7c9082"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#dce2dc"; }}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar — patient list */}
        <div style={{
          width: 340, borderRight: "1px solid #dce2dc",
          background: "#ffffff",
          padding: "24px 20px", overflowY: "auto",
          flexShrink: 0,
        }}>
          <SOSPanel alerts={sosAlerts} onAcknowledge={handleAcknowledge} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#6a776c", fontWeight: 700, letterSpacing: 1 }}>
              ACTIVE PATIENTS ({patients.length})
            </div>
            <button onClick={() => setShowAddPatient(true)} style={{
              background: "#5b705f", color: "#fff", border: "none",
              borderRadius: 8, padding: "6px 14px", fontSize: 12,
              fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 4px rgba(91, 112, 95, 0.2)",
              transition: "all 0.2s",
            }}>+ Register Patient</button>
          </div>

          {showAddPatient && (
            <div style={{
              background: "#f4f7f3", border: "1px solid #dce2dc",
              borderRadius: 14, padding: 18, marginBottom: 18,
            }}>
              <div style={{ fontWeight: 700, color: "#2b352c", fontSize: 15, marginBottom: 14 }}>Register New Patient</div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a776c", marginBottom: 4 }}>Full Name</label>
                <input placeholder="e.g. Robert Chen" value={newPatient.name}
                  onChange={e => setNewPatient(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a776c", marginBottom: 4 }}>Patient ID</label>
                  <input placeholder="e.g. 101" value={newPatient.patient_id}
                    onChange={e => setNewPatient(p => ({ ...p, patient_id: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a776c", marginBottom: 4 }}>Room Number</label>
                  <input placeholder="e.g. 312" value={newPatient.room_number}
                    onChange={e => setNewPatient(p => ({ ...p, room_number: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a776c", marginBottom: 4 }}>Primary Diagnosis</label>
                <input placeholder="e.g. Spinal Injury" value={newPatient.condition}
                  onChange={e => setNewPatient(p => ({ ...p, condition: e.target.value }))} style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a776c", marginBottom: 4 }}>Age</label>
                  <input placeholder="Age" type="number" value={newPatient.age}
                    onChange={e => setNewPatient(p => ({ ...p, age: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6a776c", marginBottom: 4 }}>Gaze Password</label>
                  <input placeholder="Password" type="text" value={newPatient.password || ""}
                    onChange={e => setNewPatient(p => ({ ...p, password: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleAddPatient} disabled={adding} style={{
                  flex: 1, background: "#5b705f", color: "#fff", border: "none",
                  borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer",
                  transition: "background 0.2s"
                }}
                  onMouseOver={(e) => e.currentTarget.style.background = "#485a4c"}
                  onMouseOut={(e) => e.currentTarget.style.background = "#5b705f"}
                >{adding ? "Registering..." : "Register ✓"}</button>
                <button onClick={() => setShowAddPatient(false)} style={{
                  flex: 1, background: "#ffffff", color: "#6a776c", border: "1px solid #dce2dc",
                  borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer",
                  transition: "background 0.2s"
                }}
                  onMouseOver={(e) => e.currentTarget.style.background = "#f4f7f3"}
                  onMouseOut={(e) => e.currentTarget.style.background = "#ffffff"}
                >Cancel</button>
              </div>
            </div>
          )}
          {patients
            .sort((a, b) => {
              const order = { red: 0, amber: 1, green: 2 };
              return (order[a.alertStatus] ?? 3) - (order[b.alertStatus] ?? 3);
            })
            .map(p => (
              <PatientCard
                key={p.id} patient={p}
                onSelect={selectPatient}
                selected={selected?.id === p.id}
              />
            ))
          }
          {!patients.length && (
            <div style={{ color: "#6a776c", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No patients loaded</div>
          )}
        </div>

        {/* Main content — reports */}
        <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
          <PatientDetail
            patient={selected}
            reports={reports}
            trends={trends}
            loading={loadingReports}
            onDelete={handleDeletePatient}
          />
        </div>
      </div>
    </div>
  );
}
