import React, { useState } from "react";
import { login } from "../shared/api";

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(username, password);
      onLogin();
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: "#f4f7f3", minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{
        background: "#ffffff", borderRadius: 20,
        padding: "40px 48px", width: 380,
        boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
        border: "1px solid #dce2dc",
        boxSizing: "border-box",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🏥</div>
          <h1 style={{ margin: 0, fontSize: 26, color: "#2b352c", fontWeight: 800 }}>ISpeak Portal</h1>
          <p style={{ margin: "6px 0 0", color: "#6a776c", fontSize: 14 }}>Caregiver & Clinician Dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6a776c", marginBottom: 6 }}>
              Username
            </label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="e.g. nurse1"
              required
              style={{
                width: "100%", background: "#ffffff", border: "1px solid #dce2dc",
                borderRadius: 8, padding: "12px 14px", color: "#2b352c",
                fontSize: 15, boxSizing: "border-box", outline: "none",
                transition: "border-color 0.2s",
              }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6a776c", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%", background: "#ffffff", border: "1px solid #dce2dc",
                borderRadius: 8, padding: "12px 14px", color: "#2b352c",
                fontSize: 15, boxSizing: "border-box", outline: "none",
                transition: "border-color 0.2s",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5",
              padding: "10px 14px", borderRadius: 8,
              fontSize: 13, marginBottom: 20,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", background: "#5b705f", color: "#fff",
            border: "none", borderRadius: 8, padding: "14px",
            fontSize: 16, fontWeight: 700, cursor: loading ? "wait" : "pointer",
            boxShadow: "0 4px 12px rgba(91, 112, 95, 0.25)",
            transition: "all 0.2s",
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Verifying Credentials..." : "Enter Clinician Portal →"}
          </button>
        </form>
      </div>
    </div>
  );
}
