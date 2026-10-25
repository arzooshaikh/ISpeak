import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useOrloskyGaze
 *
 * Drop-in replacement for useMediaPipeGaze that uses the
 * JEOresearch/EyeTracker (Orlosky pupil detector) running on the
 * Django backend, connected over WebSocket.
 *
 * The Python tracker emits raw normalised iris ratios { rx, ry }.
 * This hook applies the same calibration + EMA-smoothing pipeline
 * as useMediaPipeGaze so all downstream components (GazeZone,
 * GazeButton, useDwellTime, Calibration) continue to work unchanged.
 *
 * Returns exactly the same API shape as useMediaPipeGaze:
 *   Gaze:  { gazeX, gazeY, isReady, isCalibrated }
 *   Blink: { blinkCount, lastBlink }
 *   Setup: { mediaError, addCalibrationPoint, finalizeCalibration,
 *             resetCalibration, getCurrentRatio }
 */

// ── WebSocket URL ─────────────────────────────────────────────────────────────
const WS_URL = (() => {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host  = window.location.hostname;
  // Django dev server typically runs on 8000; adjust if needed via env
  const port  = import.meta.env.VITE_BACKEND_PORT || "8000";
  return `${proto}://${host}:${port}/ws/gaze/`;
})();

const RECONNECT_DELAY_MS = 2000;

// ── Calibration: simple linear regression (same as useMediaPipeGaze) ─────────
function fitLinear(pairs) {
  const n = pairs.length;
  if (n < 2) return null;

  let sumRx = 0, sumSx = 0, sumRxSx = 0, sumRx2 = 0;
  let sumRy = 0, sumSy = 0, sumRySy = 0, sumRy2 = 0;

  for (const { rx, ry, sx, sy } of pairs) {
    sumRx += rx; sumSx += sx; sumRxSx += rx * sx; sumRx2 += rx * rx;
    sumRy += ry; sumSy += sy; sumRySy += ry * sy; sumRy2 += ry * ry;
  }

  const axD = n * sumRx2 - sumRx * sumRx;
  const ayD = n * sumRy2 - sumRy * sumRy;

  const ax = axD === 0 ? window.screen.width  : (n * sumRxSx - sumRx * sumSx) / axD;
  const bx = axD === 0 ? 0                    : (sumSx - ax * sumRx) / n;
  const ay = ayD === 0 ? window.screen.height : (n * sumRySy - sumRy * sumSy) / ayD;
  const by = ayD === 0 ? 0                    : (sumSy - ay * sumRy) / n;

  return { ax, bx, ay, by };
}

// ── Adaptive accuracy config (same helpers as useMediaPipeGaze) ───────────────
export function getPatientAccuracyConfig(patientId) {
  if (!patientId) return { clicksPerPoint: 8, samplesPerClick: 5, smoothWindow: 16, redoCount: 0 };
  try {
    const s = localStorage.getItem(`ispeak_patient_accuracy_config_${patientId}`);
    if (s) return JSON.parse(s);
  } catch (_) { }
  return { clicksPerPoint: 8, samplesPerClick: 5, smoothWindow: 16, redoCount: 0 };
}

export function incrementPatientRedoCount(patientId) {
  if (!patientId) return;
  const cfg = getPatientAccuracyConfig(patientId);
  cfg.redoCount = (cfg.redoCount || 0) + 1;
  if (cfg.redoCount >= 2) {
    cfg.clicksPerPoint = 12;
    cfg.samplesPerClick = 8;
    cfg.smoothWindow   = 16;
  }
  localStorage.setItem(`ispeak_patient_accuracy_config_${patientId}`, JSON.stringify(cfg));
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useOrloskyGaze({ patientId, onBlink, onHold } = {}) {
  const [gazeX,        setGazeX]        = useState(0);
  const [gazeY,        setGazeY]        = useState(0);
  const [isReady,      setIsReady]      = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(() => {
    if (patientId) {
      try { return !!localStorage.getItem(`ispeak_calibration_model_${patientId}`); }
      catch (_) { }
    }
    return false;
  });
  const [blinkCount, setBlinkCount] = useState(0);
  const [lastBlink,  setLastBlink]  = useState(null);
  const [mediaError, setMediaError] = useState("");

  // Latest raw ratio from the tracker (exposed so Calibration can sample it)
  const currentRatioRef = useRef(null);
  const getCurrentRatio = useCallback(() => currentRatioRef.current, []);

  // Calibration
  const calibDataRef = useRef([]);
  const modelRef     = useRef(null);

  // EMA smoothing
  const prevSmoothedX = useRef(null);
  const prevSmoothedY = useRef(null);

  // WebSocket + reconnect
  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const mountedRef     = useRef(true);

  // ── Load cached calibration model on patientId change ─────────────────────
  useEffect(() => {
    if (patientId) {
      try {
        const s = localStorage.getItem(`ispeak_calibration_model_${patientId}`);
        if (s) {
          modelRef.current = JSON.parse(s);
          setIsCalibrated(true);
        } else {
          modelRef.current = null;
          setIsCalibrated(false);
        }
        prevSmoothedX.current = null;
        prevSmoothedY.current = null;
      } catch (_) { }
    }
  }, [patientId]);

  // ── Calibration callbacks ─────────────────────────────────────────────────
  const addCalibrationPoint = useCallback((screenX, screenY, currentRatio) => {
    if (!currentRatio) return;
    calibDataRef.current.push({
      rx: currentRatio.rx,
      ry: currentRatio.ry,
      sx: screenX,
      sy: screenY,
    });
  }, []);

  const finalizeCalibration = useCallback(() => {
    const model = fitLinear(calibDataRef.current);
    if (model) {
      modelRef.current = model;
      setIsCalibrated(true);
      prevSmoothedX.current = null;
      prevSmoothedY.current = null;
      if (patientId) {
        try {
          localStorage.setItem(
            `ispeak_calibration_model_${patientId}`,
            JSON.stringify(model)
          );
        } catch (_) { }
      }
    }
  }, [patientId]);

  const resetCalibration = useCallback(() => {
    calibDataRef.current = [];
    modelRef.current     = null;
    setIsCalibrated(false);
    prevSmoothedX.current = null;
    prevSmoothedY.current = null;
    if (patientId) {
      try {
        localStorage.removeItem(`ispeak_calibration_model_${patientId}`);
        incrementPatientRedoCount(patientId);
      } catch (_) { }
    }
  }, [patientId]);

  // ── Handle incoming WebSocket message ─────────────────────────────────────
  const handleMessage = useCallback((event) => {
    let msg;
    try { msg = JSON.parse(event.data); }
    catch { return; }

    if (msg.type === "ready") {
      setIsReady(true);
      return;
    }

    if (msg.type === "error") {
      setMediaError(msg.message || "Eye tracker error");
      return;
    }

    if (msg.type === "blink") {
      setBlinkCount(c => c + 1);
      setLastBlink("blink");
      onBlink?.();
      return;
    }

    if (msg.type === "hold") {
      setLastBlink("hold");
      onHold?.();
      return;
    }

    if (msg.type !== "gaze") return;

    // ── Map rx/ry to screen coords ──────────────────────────────────────────
    const { rx, ry } = msg;
    currentRatioRef.current = { rx, ry, isFallback: false };

    const sw = window.innerWidth;
    const sh = window.innerHeight;
    let rawX, rawY;

    if (modelRef.current && !isNaN(modelRef.current.ax)) {
      const { ax, bx, ay, by } = modelRef.current;
      rawX = ax * rx + bx;
      rawY = ay * ry + by;
    } else {
      // Pre-calibration fallback: spread the ratio across the screen
      rawX = rx * sw * 2.0 - sw * 0.5;
      rawY = ry * sh * 3.0 - sh * 0.3;
    }

    if (isNaN(rawX)) rawX = sw / 2;
    if (isNaN(rawY)) rawY = sh / 2;
    rawX = Math.max(0, Math.min(sw, rawX));
    rawY = Math.max(0, Math.min(sh, rawY));

    // ── Adaptive EMA smoothing (same params as useMediaPipeGaze) ───────────
    let smoothedX, smoothedY;
    if (prevSmoothedX.current === null || prevSmoothedY.current === null) {
      smoothedX = rawX;
      smoothedY = rawY;
    } else {
      const dx   = rawX - prevSmoothedX.current;
      const dy   = rawY - prevSmoothedY.current;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minAlpha = 0.02, maxAlpha = 0.35, dScale = 180;
      const alpha = minAlpha + (maxAlpha - minAlpha) * (1 - Math.exp(-dist / dScale));
      smoothedX = prevSmoothedX.current + alpha * dx;
      smoothedY = prevSmoothedY.current + alpha * dy;
    }
    prevSmoothedX.current = smoothedX;
    prevSmoothedY.current = smoothedY;

    setGazeX(smoothedX);
    setGazeY(smoothedY);

    window.dispatchEvent(
      new CustomEvent("gaze-update", { detail: { x: smoothedX, y: smoothedY } })
    );
  }, [onBlink, onHold]);

  // ── WebSocket connection + auto-reconnect ─────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      let ws;
      try {
        ws = new WebSocket(WS_URL);
      } catch (e) {
        setMediaError(`Cannot connect to eye tracker backend: ${e.message}`);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setMediaError("");
        // Server will emit "ready" once the camera opens
      };

      ws.onmessage = handleMessage;

      ws.onclose = (e) => {
        if (!mountedRef.current) return;
        setIsReady(false);
        if (e.code !== 1000) {
          // Unexpected close → reconnect
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setMediaError(
          "Cannot reach eye tracker backend. Make sure Django is running (python manage.py runserver)."
        );
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [handleMessage]);

  return {
    // Gaze
    gazeX, gazeY, isReady, isCalibrated,
    // Blink
    blinkCount, lastBlink,
    // Setup
    mediaError, addCalibrationPoint, finalizeCalibration, resetCalibration,
    getCurrentRatio,
  };
}
