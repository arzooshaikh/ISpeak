import { useEffect, useRef, useState, useCallback } from "react";

// MediaPipe landmark indices for each eye
const LEFT_EYE  = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

const EAR_THRESHOLD   = 0.2;   // below this = eye closed
const BLINK_MIN_MS    = 150;   // shorter = involuntary, ignore
const BLINK_MAX_MS    = 400;   // longer = deliberate hold action
const LOAD_TIMEOUT_MS = 8000;

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function calcEAR(landmarks, indices) {
  const [p1, p2, p3, p4, p5, p6] = indices.map((i) => landmarks[i]);
  return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4));
}

/**
 * useBlink — detects voluntary blinks via MediaPipe Face Mesh + EAR.
 *
 * onBlink()       → fired on voluntary blink (150–400 ms close)
 * onHold()        → fired on deliberate long hold (> 400 ms)
 *
 * Returns: { blinkCount, lastBlink, mediaReady, mediaError }
 */
export function useBlink({ onBlink, onHold } = {}) {
  const [blinkCount, setBlinkCount] = useState(0);
  const [lastBlink, setLastBlink]   = useState(null); // "blink" | "hold" | null
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState("");

  const videoRef        = useRef(null);
  const rafRef          = useRef(null);
  const eyeClosedSince  = useRef(null);
  const faceMeshRef     = useRef(null);

  const handleResults = useCallback((results) => {
    if (!results.multiFaceLandmarks?.length) return;
    const lm = results.multiFaceLandmarks[0];

    const earL = calcEAR(lm, LEFT_EYE);
    const earR = calcEAR(lm, RIGHT_EYE);
    const ear  = (earL + earR) / 2;

    const now = Date.now();

    if (ear < EAR_THRESHOLD) {
      // Eye closing
      if (!eyeClosedSince.current) eyeClosedSince.current = now;
    } else {
      // Eye opened
      if (eyeClosedSince.current) {
        const duration = now - eyeClosedSince.current;
        eyeClosedSince.current = null;

        if (duration >= BLINK_MIN_MS && duration <= BLINK_MAX_MS) {
          // Voluntary blink
          setBlinkCount((c) => c + 1);
          setLastBlink("blink");
          onBlink?.();
        } else if (duration > BLINK_MAX_MS) {
          // Deliberate hold
          setLastBlink("hold");
          onHold?.();
        }
        // < BLINK_MIN_MS = involuntary, ignore
      }
    }
  }, [onBlink, onHold]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      // Wait for MediaPipe to be available (loaded via CDN in index.html)
      const deadline = Date.now() + LOAD_TIMEOUT_MS;
      while (!window.FaceMesh) {
        if (Date.now() > deadline) {
          if (!cancelled) setMediaError("MediaPipe did not load in time");
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      if (cancelled) return;

      // Get webcam stream
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (e) {
        if (!cancelled) setMediaError("Webcam access denied for blink detection");
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

      // Create hidden video element
      const video = document.createElement("video");
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;
      await video.play();

      // Init FaceMesh
      const faceMesh = new window.FaceMesh({
        locateFile: (f) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      faceMesh.onResults(handleResults);
      faceMeshRef.current = faceMesh;

      if (!cancelled) setMediaReady(true);

      // rAF loop
      const tick = async () => {
        if (cancelled) return;
        if (video.readyState >= 2) {
          await faceMesh.send({ image: video });
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [handleResults]);

  return { blinkCount, lastBlink, mediaReady, mediaError };
}
