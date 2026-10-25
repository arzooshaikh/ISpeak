import React, { useState, useEffect } from "react";
import { isLoggedIn } from "./shared/api";
import PatientLoginScreen from "./patient/PatientLoginScreen";
import PatientFlow from "./patient/PatientFlow";
import NurseDashboard from "./dashboard/NurseDashboard";
import LoginScreen from "./dashboard/LoginScreen";

export default function App() {
  const [route, setRoute] = useState(window.location.hash || "#home");
  const [patient, setPatient] = useState(null);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());

  // Listen to hash routes
  useEffect(() => {
    const handleHash = () => {
      setRoute(window.location.hash || "#home");
      // Check login status dynamically when route changes
      setLoggedIn(isLoggedIn());
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // ── ROUTING LOGIC ──────────────────────────────────────────────────────────

  // 1. Doctor Dashboard
  if (route === "#doctor/dashboard") {
    if (!loggedIn) {
      window.location.hash = "#doctor/login";
      return null;
    }
    return <NurseDashboard />;
  }

  // 2. Doctor Login
  if (route === "#doctor/login") {
    if (loggedIn) {
      window.location.hash = "#doctor/dashboard";
      return null;
    }
    return (
      <LoginScreen
        onLogin={() => {
          setLoggedIn(true);
          window.location.hash = "#doctor/dashboard";
        }}
      />
    );
  }

  // 3. Patient Login
  if (route === "#patient/login") {
    if (patient) {
      window.location.hash = "#patient/flow";
      return null;
    }
    return (
      <PatientLoginScreen
        onLoginSuccess={(p) => {
          setPatient(p);
          window.location.hash = "#patient/flow";
        }}
      />
    );
  }

  // 4. Patient Flow
  if (route === "#patient/flow") {
    if (!patient) {
      window.location.hash = "#patient/login";
      return null;
    }
    return (
      <PatientFlow
        patientId={patient.id}
        patientName={patient.name}
        onSessionComplete={() => {
          setPatient(null);
          window.location.hash = "#home";
        }}
      />
    );
  }

  // 5. Stunning Landing Portal (#home / default)
  return (
    <div style={{
      background: "#f4f7f3", minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "#2b352c", padding: "40px 20px",
      boxSizing: "border-box",
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: 48, maxWidth: 640 }}>
        <div style={{ fontSize: 64, marginBottom: 16, filter: "drop-shadow(0 10px 15px rgba(91, 112, 95, 0.15))" }}>👁️</div>
        <h1 style={{ margin: 0, fontSize: 44, fontWeight: 900, color: "#2b352c", letterSpacing: "-1px" }}>
          ISpeak <span style={{ color: "#5b705f", fontWeight: 300 }}>Gaze</span>
        </h1>
        <p style={{ margin: "12px 0 0", color: "#6a776c", fontSize: 16, lineHeight: 1.6, fontWeight: 500 }}>
          Clinical-grade eye-gaze communication and intelligent patient telemetry system. 
          Select a portal below to begin.
        </p>
      </div>

      {/* Grid Portals */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 24, width: "100%", maxWidth: "800px", marginBottom: 48,
      }}>
        {/* Patient Portal Card */}
        <div 
          onClick={() => { window.location.hash = "#patient/login"; }}
          style={cardStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-6px)";
            e.currentTarget.style.boxShadow = "0 20px 40px rgba(91, 112, 95, 0.1)";
            e.currentTarget.style.borderColor = "#5b705f";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 8px 30px rgba(0, 0, 0, 0.02)";
            e.currentTarget.style.borderColor = "#dce2dc";
          }}
        >
          <div style={cardIconStyle}>👁️</div>
          <h2 style={cardTitleStyle}>Patient Portal</h2>
          <p style={cardDescStyle}>
            Launch the dwell-activated, gaze-controlled communication board. 
            Includes automatic voice synthesis and instant emergency SOS triggers.
          </p>
          <button style={patientBtnStyle}>Open Patient Terminal →</button>
        </div>

        {/* Doctor Portal Card */}
        <div 
          onClick={() => { window.location.hash = "#doctor/login"; }}
          style={cardStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-6px)";
            e.currentTarget.style.boxShadow = "0 20px 40px rgba(91, 112, 95, 0.1)";
            e.currentTarget.style.borderColor = "#5b705f";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 8px 30px rgba(0, 0, 0, 0.02)";
            e.currentTarget.style.borderColor = "#dce2dc";
          }}
        >
          <div style={cardIconStyle}>🏥</div>
          <h2 style={cardTitleStyle}>Clinician Portal</h2>
          <p style={cardDescStyle}>
            Monitor patient telemetry, access automated clinical reports, manage patient roster list 
            with secure Gaze-Keys, and receive real-time SOS alerts.
          </p>
          <button style={doctorBtnStyle}>Enter Clinician Portal →</button>
        </div>
      </div>

      {/* Footer Info */}
      <div style={{ color: "#6a776c", fontSize: 13, display: "flex", gap: 16 }}>
        <span>✔ Dynamic Calibration Skip Enabled</span>
        <span>•</span>
        <span>✔ 3x Daily Compliance Tracker Active</span>
        <span>•</span>
        <span>✔ Offline Fallback Operational</span>
      </div>
    </div>
  );
}

// ── LANDING STYLES ───────────────────────────────────────────────────────────
const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dce2dc",
  borderRadius: 24,
  padding: "36px 30px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.02)",
  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  boxSizing: "border-box",
};

const cardIconStyle = {
  fontSize: 44,
  marginBottom: 16,
};

const cardTitleStyle = {
  margin: "0 0 10px 0",
  fontSize: 22,
  fontWeight: 800,
  color: "#2b352c",
};

const cardDescStyle = {
  margin: "0 0 28px 0",
  fontSize: 14,
  color: "#6a776c",
  lineHeight: 1.6,
  flex: 1,
};

const patientBtnStyle = {
  width: "100%",
  background: "#2b352c",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  padding: "14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(43, 53, 44, 0.15)",
  transition: "background 0.2s",
};

const doctorBtnStyle = {
  width: "100%",
  background: "#5b705f",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  padding: "14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(91, 112, 95, 0.2)",
  transition: "background 0.2s",
};
