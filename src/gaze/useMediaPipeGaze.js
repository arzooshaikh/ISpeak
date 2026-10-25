import { useEffect, useRef, useState, useCallback } from "react";
// import { gazeRegistry } from "./gazeRegistry";


/**
 * Iris landmark indices (only available with refineLandmarks: true)
 * Left iris:  468 = center, 469-472 = border points
 * Right iris: 473 = center, 474-477 = border points
 *
 * Eye corner indices:
 * Left eye:  33 = left corner, 133 = right corner, 159 = top, 145 = bottom
 * Right eye: 362 = left corner, 263 = right corner, 386 = top, 374 = bottom
 *
 * EAR (blink) indices:
 * Left:  [33, 160, 158, 133, 153, 144]
 * Right: [362, 385, 387, 263, 373, 380]
 *
 * Head-pose landmarks (used for head-movement compensation):
 * Nose tip: 1, Forehead: 10, Chin: 152, Left face edge: 234, Right face edge: 454
 */

const L_IRIS = 468;
const R_IRIS = 473;
const L_EYE_L = 33;   // left corner of left eye
const L_EYE_R = 133;  // right corner of left eye
const L_EYE_T = 159;  // top of left eye
const L_EYE_B = 145;  // bottom of left eye
const R_EYE_L = 362;
const R_EYE_R = 263;
const R_EYE_T = 386;
const R_EYE_B = 374;

const LEFT_EAR_IDX = [33, 160, 158, 133, 153, 144];
const RIGHT_EAR_IDX = [362, 385, 387, 263, 373, 380];

const EAR_THRESHOLD = 0.2;
const BLINK_MIN_MS = 150;
const BLINK_MAX_MS = 400;
const LOAD_TIMEOUT = 10000;
const SMOOTH_WINDOW = 16;

// ── Head-pose landmarks & compensation tuning ───────────────────────────────
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const FACE_L = 234;
const FACE_R = 454;

const HEAD_DEAD_ZONE = 0.015;   // ignore natural micro head jitter
const HEAD_COMP_GAIN_X = 1.6;   // tune these two empirically per rig/camera
const HEAD_COMP_GAIN_Y = 1.8;

// ── Calibration mapping ──────────────────────────────────────────────────────
// We collect (irisRatioX, irisRatioY) → (screenX, screenY) pairs during
// calibration, then use a simple linear regression to map new ratios to pixels.

function dist2d(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function calcEAR(lm, indices) {
  const [p1, p2, p3, p4, p5, p6] = indices.map(i => lm[i]);
  return (dist2d(p2, p6) + dist2d(p3, p5)) / (2 * dist2d(p1, p4));
}

/**
 * Get normalised iris position within the eye socket.
 * Returns { rx, ry } in range roughly [0, 1] where
 * rx=0 → looking left, rx=1 → looking right
 * ry=0 → looking up,   ry=1 → looking down
 */
function getIrisRatio(lm) {
  const hasIris = lm && lm.length >= 478 && lm[L_IRIS] && lm[R_IRIS];

  if (hasIris) {
    const lIris = lm[L_IRIS];
    const rIris = lm[R_IRIS];

    // Left eye horizontal ratio
    const lEyeW = dist2d(lm[L_EYE_L], lm[L_EYE_R]);
    const lRx = lEyeW < 0.001 ? 0.5 : (lIris.x - lm[L_EYE_L].x) / lEyeW;

    // Right eye horizontal ratio  
    const rEyeW = dist2d(lm[R_EYE_L], lm[R_EYE_R]);
    const rRx = rEyeW < 0.001 ? 0.5 : (rIris.x - lm[R_EYE_L].x) / rEyeW;

    // Left eye vertical ratio
    const lEyeH = dist2d(lm[L_EYE_T], lm[L_EYE_B]);
    const lRy = lEyeH < 0.001 ? 0.5 : (lIris.y - lm[L_EYE_T].y) / lEyeH;

    // Right eye vertical ratio
    const rEyeH = dist2d(lm[R_EYE_T], lm[R_EYE_B]);
    const rRy = rEyeH < 0.001 ? 0.5 : (rIris.y - lm[R_EYE_T].y) / rEyeH;

    return {
      rx: (lRx + rRx) / 2,
      ry: (lRy + rRy) / 2,
      isFallback: false,
    };
  } else {
    // Fallback: Head tracking using nose tip relative to face boundary
    // Landmark 4: nose tip, 10: forehead, 152: chin, 234: left face edge, 454: right face edge
    const nose = lm ? lm[4] : null;
    const forehead = lm ? lm[10] : null;
    const chin = lm ? lm[152] : null;
    const leftFace = lm ? lm[234] : null;
    const rightFace = lm ? lm[454] : null;

    if (nose && forehead && chin && leftFace && rightFace) {
      const faceW = dist2d(leftFace, rightFace);
      const faceH = dist2d(forehead, chin);

      // Normalise nose position within face boundaries
      const rx = faceW < 0.001 ? 0.5 : (nose.x - leftFace.x) / faceW;
      const ry = faceH < 0.001 ? 0.5 : (nose.y - forehead.y) / faceH;

      return {
        rx,
        ry,
        isFallback: true,
      };
    }

    return { rx: 0.5, ry: 0.5, isFallback: true };
  }
}

/**
 * Estimate head yaw/pitch as a ratio of nose-tip offset from face center.
 * Independent of iris — works even in fallback mode, but we only use it
 * as a *correction* on top of iris-based tracking, not as fallback mode itself.
 */
function getHeadPose(lm) {
  const nose = lm[NOSE_TIP];
  const forehead = lm[FOREHEAD];
  const chin = lm[CHIN];
  const leftFace = lm[FACE_L];
  const rightFace = lm[FACE_R];
  if (!nose || !forehead || !chin || !leftFace || !rightFace) return null;

  const faceW = dist2d(leftFace, rightFace);
  const faceH = dist2d(forehead, chin);
  const centerX = (leftFace.x + rightFace.x) / 2;
  const centerY = (forehead.y + chin.y) / 2;

  return {
    yaw: faceW < 0.001 ? 0 : (nose.x - centerX) / faceW,
    pitch: faceH < 0.001 ? 0 : (nose.y - centerY) / faceH,
  };
}

/**
 * Simple linear regression: given N (rx,ry)→(sx,sy) calibration pairs,
 * fit sx = ax*rx + bx and sy = ay*ry + by using least squares.
 */
function fitLinear(pairs) {
  // pairs: [{ rx, ry, sx, sy }]
  const n = pairs.length;
  if (n < 2) return null;

  // Fit X: sx = ax*rx + bx
  let sumRx = 0, sumSx = 0, sumRxSx = 0, sumRx2 = 0;
  let sumRy = 0, sumSy = 0, sumRySy = 0, sumRy2 = 0;

  for (const { rx, ry, sx, sy } of pairs) {
    sumRx += rx; sumSx += sx; sumRxSx += rx * sx; sumRx2 += rx * rx;
    sumRy += ry; sumSy += sy; sumRySy += ry * sy; sumRy2 += ry * ry;
  }

  const axDenom = n * sumRx2 - sumRx * sumRx;
  const ayDenom = n * sumRy2 - sumRy * sumRy;

  const ax = axDenom === 0 ? window.screen.width : (n * sumRxSx - sumRx * sumSx) / axDenom;
  const bx = axDenom === 0 ? 0 : (sumSx - ax * sumRx) / n;
  const ay = ayDenom === 0 ? window.screen.height : (n * sumRySy - sumRy * sumSy) / ayDenom;
  const by = ayDenom === 0 ? 0 : (sumSy - ay * sumRy) / n;

  return { ax, bx, ay, by };
}

// ── Adaptive Accuracy Config ────────────────────────────────────────────────
export function getPatientAccuracyConfig(patientId) {
  if (!patientId) {
    return { clicksPerPoint: 8, samplesPerClick: 5, smoothWindow: 16, redoCount: 0 };
  }
  try {
    const stored = localStorage.getItem(`ispeak_patient_accuracy_config_${patientId}`);
    if (stored) return JSON.parse(stored);
  } catch (_) { }
  return { clicksPerPoint: 8, samplesPerClick: 5, smoothWindow: 16, redoCount: 0 };
}

export function incrementPatientRedoCount(patientId) {
  if (!patientId) return;
  const config = getPatientAccuracyConfig(patientId);
  config.redoCount = (config.redoCount || 0) + 1;

  // Upgrade accuracy settings dynamically in case of recurrent redo/recalibration
  if (config.redoCount >= 2) {
    config.clicksPerPoint = 12;   // more click iterations to reduce regression fit error
    config.samplesPerClick = 8;   // more camera frames sampled to filter out micro-saccades
    config.smoothWindow = 16;     // increase smoothing window to dampen hand/eye tremors
  }
  localStorage.setItem(`ispeak_patient_accuracy_config_${patientId}`, JSON.stringify(config));
  console.log(`[Adaptive Accuracy] Calibration upgrade for patient ${patientId}:`, config);
}

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * useMediaPipeGaze
 *
 * Combines iris-based gaze tracking + blink detection in ONE FaceMesh instance.
 * Now includes head-movement compensation: during calibration we record a
 * neutral head-pose baseline, and at runtime we subtract deviations from that
 * baseline out of the raw gaze estimate so head rotation doesn't drag the
 * cursor off target.
 *
 * Returns:
 *   Gaze:  { gazeX, gazeY, isReady, isCalibrated }
 *   Blink: { blinkCount, lastBlink }
 *   Setup: { mediaError, addCalibrationPoint, finalizeCalibration, resetCalibration }
 */
export function useMediaPipeGaze({ patientId, onBlink, onHold } = {}) {
  const [gazeX, setGazeX] = useState(0);
  const [gazeY, setGazeY] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(() => {
    if (patientId) {
      try {
        const stored = localStorage.getItem(`ispeak_calibration_model_${patientId}`);
        return !!stored;
      } catch (_) { }
    }
    return false;
  });
  const [blinkCount, setBlinkCount] = useState(0);
  const [lastBlink, setLastBlink] = useState(null);
  const [mediaError, setMediaError] = useState("");

  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const eyeClosedSince = useRef(null);
  const calibDataRef = useRef([]);   // { rx, ry, sx, sy, headYaw, headPitch }[]
  const getInitModel = () => {
    if (patientId) {
      try {
        const stored = localStorage.getItem(`ispeak_calibration_model_${patientId}`);
        if (stored) {
          console.log(`[useMediaPipeGaze] Initialized model from cache for patient ${patientId}`);
          return JSON.parse(stored);
        }
      } catch (_) { }
    }
    return null;
  };
  const modelRef = useRef(getInitModel());
  const smoothBuf = useRef([]);
  const prevSmoothedX = useRef(null);
  const prevSmoothedY = useRef(null);

  // Current head pose (updated every frame, sampled during calibration clicks)
  const currentHeadPoseRef = useRef(null);

  // Ensure model matches patient on runtime patient changes
  useEffect(() => {
    if (patientId) {
      try {
        const stored = localStorage.getItem(`ispeak_calibration_model_${patientId}`);
        if (stored) {
          modelRef.current = JSON.parse(stored);
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

  // ── Called from Calibration component for each dot click ──────────────────
  const addCalibrationPoint = useCallback((screenX, screenY, currentRatio) => {
    if (!currentRatio) return;
    const headPose = currentHeadPoseRef.current;
    calibDataRef.current.push({
      rx: currentRatio.rx,
      ry: currentRatio.ry,
      sx: screenX,
      sy: screenY,
      headYaw: headPose ? headPose.yaw : undefined,
      headPitch: headPose ? headPose.pitch : undefined,
    });
  }, []);

  const finalizeCalibration = useCallback(() => {
    const model = fitLinear(calibDataRef.current);
    if (model) {
      // Average head pose across calibration clicks → "neutral" head position
      const headSamples = calibDataRef.current.filter(p => typeof p.headYaw === "number");
      if (headSamples.length > 0) {
        model.headBaseline = {
          yaw: headSamples.reduce((s, p) => s + p.headYaw, 0) / headSamples.length,
          pitch: headSamples.reduce((s, p) => s + p.headPitch, 0) / headSamples.length,
        };
      }

      modelRef.current = model;
      setIsCalibrated(true);
      smoothBuf.current = [];
      prevSmoothedX.current = null;
      prevSmoothedY.current = null;
      if (patientId) {
        try {
          localStorage.setItem(`ispeak_calibration_model_${patientId}`, JSON.stringify(model));
          console.log(`[useMediaPipeGaze] Stored calibration model for patient ${patientId}`);
        } catch (_) { }
      }
    }
  }, [patientId]);

  const resetCalibration = useCallback(() => {
    calibDataRef.current = [];
    modelRef.current = null;
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

  // ── Current iris ratio (exposed so Calibration can sample it) ─────────────
  const currentRatioRef = useRef(null);
  const getCurrentRatio = useCallback(() => currentRatioRef.current, []);

  // ── FaceMesh result handler ───────────────────────────────────────────────
  const handleResults = useCallback((results) => {
    try {
      if (!results.multiFaceLandmarks?.length) return;
      const lm = results.multiFaceLandmarks[0];

      // ── Iris / Head gaze ratio ──
      const ratio = getIrisRatio(lm);
      currentRatioRef.current = ratio;

      // ── Head pose (for compensation) ──
      const headPose = getHeadPose(lm);
      currentHeadPoseRef.current = headPose;

      // Map iris ratio to screen — use calibration model if ready, else rough fallback
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      let rawX, rawY;
      if (modelRef.current && typeof modelRef.current === "object" && !isNaN(modelRef.current.ax)) {
        const { ax, bx, ay, by } = modelRef.current;
        rawX = ax * ratio.rx + bx;
        rawY = ay * ratio.ry + by;
      } else {
        if (ratio.isFallback) {
          // Boosted gain for smaller head-rotation ranges
          rawX = (ratio.rx - 0.5) * sw * 3.5 + sw * 0.5;
          rawY = (ratio.ry - 0.5) * sh * 4.5 + sh * 0.5;
        } else {
          rawX = ratio.rx * sw * 2.0 - sw * 0.5;
          rawY = ratio.ry * sh * 3.0 - sh * 0.3;
        }
      }

      // ── Head movement compensation ──
      // Only when calibrated + using iris-based tracking (not fallback, which
      // already IS head-pose tracking — applying this there would double-count).
      if (modelRef.current?.headBaseline && !ratio.isFallback && headPose) {
        const dYaw = headPose.yaw - modelRef.current.headBaseline.yaw;
        const dPitch = headPose.pitch - modelRef.current.headBaseline.pitch;

        const cYaw = Math.abs(dYaw) > HEAD_DEAD_ZONE ? dYaw : 0;
        const cPitch = Math.abs(dPitch) > HEAD_DEAD_ZONE ? dPitch : 0;

        rawX -= cYaw * sw * HEAD_COMP_GAIN_X;
        rawY -= cPitch * sh * HEAD_COMP_GAIN_Y;
      }

      if (isNaN(rawX)) rawX = sw / 2;
      if (isNaN(rawY)) rawY = sh / 2;

      rawX = Math.max(0, Math.min(sw, rawX));
      rawY = Math.max(0, Math.min(sh, rawY));

      // Adaptive Exponential Moving Average (EMA) smoothing for eye gaze
      let smoothedX, smoothedY;
      if (prevSmoothedX.current === null || prevSmoothedY.current === null) {
        smoothedX = rawX;
        smoothedY = rawY;
      } else {
        const dx = rawX - prevSmoothedX.current;
        const dy = rawY - prevSmoothedY.current;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Alpha parameters: heavy smoothing at rest, responsive during fast movement
        const minAlpha = 0.02;
        const maxAlpha = 0.35;
        const dScale = 180; // pixel distance scale for transitioning between low/high alpha

        const alpha = minAlpha + (maxAlpha - minAlpha) * (1 - Math.exp(-dist / dScale));
        smoothedX = prevSmoothedX.current + alpha * dx;
        smoothedY = prevSmoothedY.current + alpha * dy;
      }

      prevSmoothedX.current = smoothedX;
      prevSmoothedY.current = smoothedY;

      setGazeX(smoothedX);
      setGazeY(smoothedY);
      // Always dispatch so useDwellTime works even before full calibration
      const gazeX = smoothedX ?? sw / 2;
      const gazeY = smoothedY ?? sh / 2;

      window.dispatchEvent(
        new CustomEvent("gaze-update", {
          detail: {
            x: gazeX,
            y: gazeY
          }
        })
      );


      // ── Blink ──
      const earL = calcEAR(lm, LEFT_EAR_IDX);
      const earR = calcEAR(lm, RIGHT_EAR_IDX);
      const ear = (earL + earR) / 2;
      const now = Date.now();

      if (ear < EAR_THRESHOLD) {
        if (!eyeClosedSince.current) eyeClosedSince.current = now;
      } else {
        if (eyeClosedSince.current) {
          const dur = now - eyeClosedSince.current;
          eyeClosedSince.current = null;
          if (dur >= BLINK_MIN_MS && dur <= BLINK_MAX_MS) {
            setBlinkCount(c => c + 1);
            setLastBlink("blink");
            onBlink?.();
          } else if (dur > BLINK_MAX_MS) {
            setLastBlink("hold");
            onHold?.();
          }
        }
      }
    } catch (err) {
      console.error("[useMediaPipeGaze] handleResults runtime error:", err);
      setMediaError(`Eye tracking runtime error: ${err.message}`);
    }
  }, [onBlink, onHold, patientId]);

  // ── Setup FaceMesh once ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        const deadline = Date.now() + LOAD_TIMEOUT;
        while (!window.FaceMesh) {
          if (Date.now() > deadline) {
            if (!cancelled) setMediaError("MediaPipe did not load. Check your internet connection.");
            return;
          }
          await new Promise(r => setTimeout(r, 200));
        }
        if (cancelled) return;

        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        } catch (e) {
          if (!cancelled) setMediaError("Camera access denied. Please allow camera access and reload.");
          return;
        }
        if (cancelled) {
          if (stream) stream.getTracks().forEach(t => t.stop());
          return;
        }

        const video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        video.muted = true;
        video.style.position = "fixed";
        video.style.top = "-9999px";
        video.style.left = "-9999px";
        video.style.width = "1px";
        video.style.height = "1px";
        video.style.opacity = "0";
        video.style.pointerEvents = "none";
        document.body.appendChild(video);

        video.srcObject = stream;
        videoRef.current = video;
        await video.play();

        const faceMesh = new window.FaceMesh({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        });
        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,       // REQUIRED for iris landmarks 468-477
          minDetectionConfidence: 0.8,
          minTrackingConfidence: 0.8,
        });
        faceMesh.onResults(handleResults);

        if (!cancelled) setIsReady(true);

        const tick = async () => {
          if (cancelled) return;
          try {
            if (video.readyState >= 2) {
              await faceMesh.send({ image: video });
            }
          } catch (e) {
            console.error("[useMediaPipeGaze] faceMesh.send error:", e);
            if (!cancelled) {
              setMediaError(`FaceMesh processing error: ${e.message}`);
            }
            return; // stop the loop on failure
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error("[useMediaPipeGaze] Setup failed:", err);
        if (!cancelled) {
          setMediaError(`Eye tracking initialization failed: ${err.message}`);
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (videoRef.current) {
        if (videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        if (videoRef.current.parentNode) {
          videoRef.current.parentNode.removeChild(videoRef.current);
        }
      }
    };
  }, [handleResults]);

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