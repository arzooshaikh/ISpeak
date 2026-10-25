import React, { useState } from "react";
import { patientLogin, initializePatientPassword } from "../shared/api";

export default function PatientLoginScreen({ onLoginSuccess }) {
  const [patientId, setPatientId] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState("id-entry"); // id-entry | password-entry | password-setup
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempPatient, setTempPatient] = useState(null);

  async function handleIdSubmit(e) {
    e.preventDefault();
    if (!patientId.trim()) return;
    setError("");
    setLoading(true);

    try {
      // Dry-login to check setup status
      const res = await patientLogin(patientId, "");
      // If no error thrown with empty password, it shouldn't happen unless password was empty
      if (res.success) {
        onLoginSuccess(res.patient);
      }
    } catch (err) {
      if (err.message.includes("Incorrect Password") || err.message.includes("setupNeeded") || err.message.includes("forgot your password")) {
        // Patient exists, needs password check
        setError("");
        setStep("password-entry");
      } else if (err.message.includes("Patient not found") || err.message.includes("Invalid Patient ID")) {
        setError("Patient ID not found in roster. Please contact your doctor.");
      } else {
        // Checking first-time setup via local query
        try {
          const res = await patientLogin(patientId, "");
          if (res.setupNeeded) {
            setTempPatient(res.patient);
            setStep("password-setup");
          }
        } catch (_) {
          setError(err.message || "An error occurred.");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  // Check if we need password setup
  async function handleCheckSetup() {
    setError("");
    setLoading(true);
    try {
      const res = await patientLogin(patientId, "DUMMY_TRY_SETUP");
    } catch (err) {
      // If it throws that setup is needed, switch to setup step
      const patients = JSON.parse(localStorage.getItem("ispeak_mock_patients") || "[]");
      const p = patients.find(x => x.id === parseInt(patientId));
      if (p && !p.password) {
        setTempPatient(p);
        setStep("password-setup");
      } else {
        setStep("password-entry");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await patientLogin(patientId, password);
      if (res.success) {
        onLoginSuccess(res.patient);
      }
    } catch (err) {
      setError(err.message || "Incorrect password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupSubmit(e) {
    e.preventDefault();
    setError("");
    
    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await initializePatientPassword(patientId, newPassword);
      if (res.success) {
        onLoginSuccess(res.patient);
      }
    } catch (err) {
      setError(err.message || "Failed to set password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: "#0f172a", minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif", color: "#f8fafc",
      padding: "20px",
    }}>
      <div style={{
        background: "#1e293b", borderRadius: 24,
        padding: "40px", width: "100%", maxWidth: "420px",
        boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
        border: "1px solid #334155",
        boxSizing: "border-box",
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👁️</div>
          <h1 style={{ margin: 0, fontSize: 28, color: "#f8fafc", fontWeight: 800 }}>ISpeak Gaze</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>Patient eye-tracking portal</p>
        </div>

        {/* Step 1: ID Entry */}
        {step === "id-entry" && (
          <form onSubmit={handleIdSubmit}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 8, fontWeight: 600 }}>
                Enter your Patient ID
              </label>
              <input
                type="number"
                value={patientId}
                onChange={e => setPatientId(e.target.value)}
                placeholder="e.g. 1"
                autoFocus
                required
                style={{
                  width: "100%", background: "#0f172a", border: "2px solid #334155",
                  borderRadius: 12, padding: "14px 16px", color: "#f8fafc",
                  fontSize: 16, boxSizing: "border-box", outline: "none",
                  textAlign: "center", fontWeight: 700, letterSpacing: 0.5,
                  transition: "border-color 0.2s",
                }}
              />
              <span style={{ fontSize: 12, color: "#475569", marginTop: 6, display: "block", textAlign: "center" }}>
                Assigned to you by your ward doctor
              </span>
            </div>

            {error && (
              <div style={{
                background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d",
                padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 20,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", background: "#6366f1", color: "#fff",
              border: "none", borderRadius: 12, padding: "14px",
              fontSize: 16, fontWeight: 700, cursor: loading ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
            }}>
              {loading ? "Validating ID..." : "Continue →"}
            </button>
            
            <button
              type="button"
              onClick={handleCheckSetup}
              style={{
                width: "100%", background: "transparent", color: "#64748b",
                border: "none", marginTop: 14, fontSize: 12, cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              First-time setup? Setup Password
            </button>
          </form>
        )}

        {/* Step 2: Password Entry */}
        {step === "password-entry" && (
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>
                  Enter your gaze key password
                </label>
                <button type="button" onClick={() => setStep("id-entry")} style={{
                  background: "transparent", border: "none", color: "#6366f1",
                  fontSize: 12, cursor: "pointer", padding: 0, fontWeight: 600,
                }}>
                  Change ID
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                autoFocus
                required
                style={{
                  width: "100%", background: "#0f172a", border: "2px solid #334155",
                  borderRadius: 12, padding: "14px 16px", color: "#f8fafc",
                  fontSize: 18, boxSizing: "border-box", outline: "none",
                  textAlign: "center", letterSpacing: 4, fontWeight: 700,
                }}
              />
            </div>

            {error && (
              <div style={{
                background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d",
                padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 20,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", background: "#6366f1", color: "#fff",
              border: "none", borderRadius: 12, padding: "14px",
              fontSize: 16, fontWeight: 700, cursor: loading ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
            }}>
              {loading ? "Signing in..." : "Start Eye Session ✓"}
            </button>
          </form>
        )}

        {/* Step 3: First-time Password Setup */}
        {step === "password-setup" && (
          <form onSubmit={handleSetupSubmit}>
            <div style={{
              background: "rgba(99, 102, 241, 0.1)", border: "1px dashed #6366f1",
              padding: "14px 18px", borderRadius: 12, marginBottom: 20, fontSize: 13,
              lineHeight: 1.5, color: "#a5b4fc",
            }}>
              ✨ Welcome <strong>{tempPatient?.name || "Patient"}</strong>! To protect your eye logs, please set a numeric or text password for your profile.
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                New Password (min 4 chars)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••"
                required
                style={{
                  width: "100%", background: "#0f172a", border: "2px solid #334155",
                  borderRadius: 12, padding: "12px 14px", color: "#f8fafc",
                  fontSize: 16, boxSizing: "border-box", outline: "none",
                  textAlign: "center",
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                required
                style={{
                  width: "100%", background: "#0f172a", border: "2px solid #334155",
                  borderRadius: 12, padding: "12px 14px", color: "#f8fafc",
                  fontSize: 16, boxSizing: "border-box", outline: "none",
                  textAlign: "center",
                }}
              />
            </div>

            {error && (
              <div style={{
                background: "#450a0a", color: "#fca5a5", border: "1px solid #7f1d1d",
                padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 20,
              }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setStep("id-entry")}
                style={{
                  flex: 1, background: "#1e293b", color: "#94a3b8",
                  border: "2px solid #334155", borderRadius: 12, padding: "12px",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button type="submit" disabled={loading} style={{
                flex: 2, background: "#16a34a", color: "#fff",
                border: "none", borderRadius: 12, padding: "12px",
                fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer",
                boxShadow: "0 4px 14px rgba(22, 163, 74, 0.4)",
              }}>
                {loading ? "Saving..." : "Set & Start ✓"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
