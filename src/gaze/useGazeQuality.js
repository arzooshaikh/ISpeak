import { useState, useEffect, useRef } from "react";

const WINDOW_SIZE = 30;

/**
 * useGazeQuality — tracks gaze stability over the last N readings.
 * Returns a 0–1 score and a warning flag.
 *
 * score = 1 - (std_deviation / screen_width)
 * If score < 0.6: show warning
 */
export function useGazeQuality() {
  const [score, setScore]     = useState(1);
  const [warning, setWarning] = useState(false);
  const historyRef            = useRef([]);

  useEffect(() => {
    const handleGaze = (e) => {
      const { x, y } = e.detail;
      historyRef.current.push({ x, y });
      if (historyRef.current.length > WINDOW_SIZE) historyRef.current.shift();
      if (historyRef.current.length < 5) return; // not enough data yet

      const xs = historyRef.current.map((p) => p.x);
      const ys = historyRef.current.map((p) => p.y);

      const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
      const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;

      const stdX = Math.sqrt(xs.reduce((s, v) => s + (v - meanX) ** 2, 0) / xs.length);
      const stdY = Math.sqrt(ys.reduce((s, v) => s + (v - meanY) ** 2, 0) / ys.length);

      const std = (stdX + stdY) / 2;
      const sw  = window.screen.width || 1920;
      const s   = Math.max(0, Math.min(1, 1 - std / sw));

      setScore(Math.round(s * 100) / 100);
      setWarning(s < 0.6);
    };

    window.addEventListener("gaze-update", handleGaze);
    return () => window.removeEventListener("gaze-update", handleGaze);
  }, []);

  return { score, warning };
}
