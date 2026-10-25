import React, { useState, useCallback, useRef, useEffect } from "react";
import { useOrloskyGaze } from "../gaze/useOrloskyGaze";
import { useSwitchScan }    from "../gaze/useSwitchScan";
import { useGazeQuality }   from "../gaze/useGazeQuality";
import Calibration          from "../gaze/Calibration";
import GazeButton           from "../gaze/GazeButton";
import GazeDebug            from "../gaze/GazeDebug";

const BOXES = [
  { id: "red",    label: "Red",    bg: "#dc2626", glow: "#f87171", emoji: "🟥" },
  { id: "blue",   label: "Blue",   bg: "#2563eb", glow: "#60a5fa", emoji: "🟦" },
  { id: "green",  label: "Green",  bg: "#16a34a", glow: "#4ade80", emoji: "🟩" },
  { id: "yellow", label: "Yellow", bg: "#ca8a04", glow: "#fde047", emoji: "🟨" },
];

function TopBar({ gazeX, gazeY, isReady, isCalibrated, quality }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0,
      background: "#0f172a", borderBottom: "1px solid #1e293b",
      padding: "10px 24px", display: "flex", alignItems: "center",
      gap: 32, zIndex: 100, fontFamily: "monospace", fontSize: 13,
    }}>
      <span style={{ color: "#00e5ff", fontWeight: 700 }}>ISpeak</span>
      <span style={{ color: "#475569" }}>
        Gaze: <span style={{ color: "#94a3b8" }}>({Math.round(gazeX)}, {Math.round(gazeY)})</span>
      </span>
      <span style={{ color: "#475569" }}>
        Quality:{" "}
        <span style={{ color: quality.score > 0.6 ? "#4ade80" : "#f87171" }}>
          {Math.round(quality.score * 100)}%
        </span>
        {quality.warning && (
          <span style={{ color: "#f87171", marginLeft: 8 }}>⚠ Look directly at screen</span>
        )}
      </span>
      <span style={{ marginLeft: "auto", fontSize: 11 }}>
        <span style={{ color: isReady ? "#4ade80" : "#f87171" }}>
          {isReady ? "● Orlosky Tracker" : "○ Connecting..."}
        </span>
        <span style={{ color: "#334155", margin: "0 8px" }}>|</span>
        <span style={{ color: isCalibrated ? "#4ade80" : "#fbbf24" }}>
          {isCalibrated ? "● Calibrated" : "○ Not calibrated"}
        </span>
      </span>
    </div>
  );
}

export default function DemoPage() {
  const [phase, setPhase]       = useState("init"); // init | calibrating | demo
  const [selected, setSelected] = useState(null);
  const [scanMode, setScanMode] = useState(false);
  const scanModeRef             = useRef(false);
  const activateRef             = useRef(null);

  const quality = useGazeQuality();

  // Orlosky eye tracker hook — handles both gaze & blink
  const {
    gazeX, gazeY, isReady, isCalibrated,
    blinkCount, lastBlink,
    mediaError,
    addCalibrationPoint, finalizeCalibration, resetCalibration, getCurrentRatio,
  } = useOrloskyGaze({
    onBlink: useCallback(() => {
      if (scanModeRef.current) activateRef.current?.();
    }, []),
  });

  // Move to calibration once MediaPipe is ready
  useEffect(() => {
    if (isReady && phase === "init") setPhase("calibrating");
  }, [isReady, phase]);

  // Switch scan
  const handleScanSelect = useCallback((label) => setSelected(label), []);
  const { activeIndex, running, start, stop, activate } = useSwitchScan(
    BOXES.map(b => b.label), handleScanSelect
  );
  useEffect(() => { activateRef.current = activate; }, [activate]);

  function toggleScan() {
    if (scanMode) { stop(); setScanMode(false); scanModeRef.current = false; }
    else          { start(); setScanMode(true);  scanModeRef.current = true; }
  }

  function handleRecalibrate() {
    stop(); setScanMode(false); scanModeRef.current = false;
    resetCalibration();
    setPhase("calibrating");
  }

  // ── Render phases ──
  if (mediaError) return (
    <div style={centerStyle}>
      <div style={{ color: "#fca5a5", fontSize: 16, textAlign: "center", maxWidth: 400 }}>
        ✗ {mediaError}<br />
        <span style={{ fontSize: 13, color: "#64748b", marginTop: 8, display: "block" }}>
          Make sure you're on localhost and camera permission is granted.
        </span>
      </div>
    </div>
  );

  if (phase === "init") return (
    <div style={centerStyle}>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#94a3b8", fontSize: 16, marginBottom: 8 }}>
          ◌ Loading MediaPipe Face Mesh...
        </div>
        <div style={{ color: "#475569", fontSize: 13 }}>
          This may take a few seconds on first load
        </div>
      </div>
    </div>
  );

  if (phase === "calibrating") return (
    <Calibration
      isReady={isReady}
      addCalibrationPoint={addCalibrationPoint}
      finalizeCalibration={finalizeCalibration}
      getCurrentRatio={getCurrentRatio}
      onDone={() => setPhase("demo")}
    />
  );

  // ── Demo ──
  return (
    <div style={{
      background: "#0f172a", color: "#f8fafc",
      fontFamily: "system-ui, sans-serif",
      minHeight: "100vh", paddingTop: "80px",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <TopBar
        gazeX={gazeX} gazeY={gazeY}
        isReady={isReady} isCalibrated={isCalibrated}
        quality={quality}
      />

      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, marginTop: 24 }}>
        ISpeak — Week 1 Gaze Demo
      </h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 36 }}>
        {scanMode
          ? "⚡ Switch Scan — blink deliberately when your box glows"
          : "👁 Look at a box for 1 second to select it"}
      </p>

      {/* 4 boxes */}
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", justifyContent: "center" }}>
        {BOXES.map((box, i) => {
          const isScanning = scanMode && activeIndex === i;
          return (
            <GazeButton
              key={box.id}
              dwellMs={1000}
              onGazeSelect={() => !scanMode && setSelected(box.label)}
              onClick={() => setSelected(box.label)}
              style={{
                width: 200, height: 200, borderRadius: 20,
                background: box.bg, flexDirection: "column", gap: 8,
                color: "#fff", fontSize: 20, fontWeight: 700,
                boxShadow: isScanning
                  ? `0 0 0 5px #fff, 0 0 40px 14px ${box.glow}`
                  : selected === box.label
                  ? `0 0 30px 10px ${box.glow}`
                  : "0 4px 20px rgba(0,0,0,0.4)",
                transform: isScanning ? "scale(1.08)" : "scale(1)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
            >
              <span style={{ fontSize: 42 }}>{box.emoji}</span>
              {box.label}
            </GazeButton>
          );
        })}
      </div>

      {/* Status row */}
      <div style={{
        marginTop: 44, display: "flex", gap: 48,
        fontSize: 16, color: "#94a3b8", flexWrap: "wrap", justifyContent: "center",
      }}>
        <div>
          Selected:{" "}
          <span style={{ color: "#f8fafc", fontWeight: 700, fontSize: 18 }}>
            {selected ?? "—"}
          </span>
        </div>
        <div>
          Voluntary blinks:{" "}
          <span style={{ color: "#f8fafc", fontWeight: 700 }}>{blinkCount}</span>
          {lastBlink === "hold" && (
            <span style={{ color: "#fbbf24", fontSize: 13, marginLeft: 8 }}>(long hold)</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={toggleScan} style={{
          background: scanMode ? "#1d4ed8" : "#1e293b",
          color: scanMode ? "#fff" : "#94a3b8",
          border: `1px solid ${scanMode ? "#3b82f6" : "#334155"}`,
          borderRadius: 8, padding: "10px 24px",
          fontSize: 14, cursor: "pointer", fontWeight: 600,
        }}>
          {scanMode ? "⏹ Stop Switch Scan" : "▶ Enable Switch Scan"}
        </button>
        <button onClick={handleRecalibrate} style={{
          background: "#1e293b", color: "#94a3b8",
          border: "1px solid #334155", borderRadius: 8,
          padding: "10px 24px", fontSize: 14, cursor: "pointer",
        }}>
          ↺ Recalibrate
        </button>
        <button onClick={() => setSelected(null)} style={{
          background: "#1e293b", color: "#94a3b8",
          border: "1px solid #334155", borderRadius: 8,
          padding: "10px 24px", fontSize: 14, cursor: "pointer",
        }}>
          ✕ Clear
        </button>
      </div>

      {!scanMode && (
        <div style={{
          marginTop: 28, background: "#1e293b", borderRadius: 12,
          padding: "14px 24px", maxWidth: 460, fontSize: 13,
          color: "#64748b", textAlign: "center",
        }}>
          <strong style={{ color: "#94a3b8" }}>Switch Scan</strong> is for patients with limited eye movement —
          boxes highlight one by one and a deliberate blink selects the active one.
        </div>
      )}

      {/* Gaze dot */}
      {isCalibrated && (
        <div style={{
          position: "fixed", width: 22, height: 22, borderRadius: "50%",
          background: "rgba(0,229,255,0.3)", border: "2px solid #00e5ff",
          pointerEvents: "none", zIndex: 9999,
          left: gazeX, top: gazeY, transform: "translate(-50%,-50%)",
        }} />
      )}

      <div style={{
        position: "fixed", bottom: 16, right: 16,
        background: "#1e293b", padding: "6px 14px",
        borderRadius: 8, fontSize: 12, color: "#475569",
      }}>
        gaze ({Math.round(gazeX)}, {Math.round(gazeY)})
      </div>
    </div>
  );
}

const centerStyle = {
  background: "#0f172a", minHeight: "100vh",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "system-ui, sans-serif",
};
