import { useState, useEffect, useRef } from "react";

const SMOOTH_WINDOW = 12; // number of readings to average (higher = smoother but more lag)

/**
 * useGaze — loads WebGazer and returns smoothed gaze coordinates.
 * Returns: { gazeX, gazeY, isReady, error }
 */
export function useGaze() {
  const [gazeX, setGazeX]     = useState(0);
  const [gazeY, setGazeY]     = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError]     = useState("");
  const historyRef            = useRef([]);

  useEffect(() => {
    let cancelled = false;

    function attachListener() {
      window.webgazer.setGazeListener((data) => {
        if (!data || cancelled) return;

        // Smooth: keep last N readings
        historyRef.current.push({ x: data.x, y: data.y });
        if (historyRef.current.length > SMOOTH_WINDOW)
          historyRef.current.shift();

        const avg = {
          x: historyRef.current.reduce((s, p) => s + p.x, 0) / historyRef.current.length,
          y: historyRef.current.reduce((s, p) => s + p.y, 0) / historyRef.current.length,
        };

        setGazeX(avg.x);
        setGazeY(avg.y);

        // Broadcast for other components to consume
        window.dispatchEvent(
          new CustomEvent("gaze-update", { detail: { x: avg.x, y: avg.y } })
        );
      });
    }

    function init() {
      window.webgazer
        .showVideoPreview(true)
        .showPredictionPoints(false)
        .begin()
        .then(() => {
          if (cancelled) return;
          attachListener();
          setIsReady(true);
        })
        .catch((e) => {
          if (!cancelled) setError(e?.message || "Camera error");
        });
    }

    if (window.webgazer) {
      init();
      return;
    }

    const script = document.createElement("script");
    script.src   = "https://cdn.jsdelivr.net/npm/webgazer@2.1.0/dist/webgazer.js";
    script.async = true;
    script.onload  = init;
    script.onerror = () => { if (!cancelled) setError("Failed to load WebGazer"); };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      if (window.webgazer) {
        try { window.webgazer.setGazeListener(null); } catch (_) {}
        try { window.webgazer.pause(); } catch (_) {}
      }
    };
  }, []);

  return { gazeX, gazeY, isReady, error };
}
