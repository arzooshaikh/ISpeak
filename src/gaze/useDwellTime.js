import { useEffect, useRef, useState, useCallback } from "react";

const COOLDOWN_MS = 2000;

export function useDwellTime(targetRef, dwellMs = 1800, onSelect) {
  const [dwelling, setDwelling] = useState(false);
  const [pct, setPct] = useState(0);

  const dwellStartRef = useRef(null);
  const intervalRef = useRef(null);
  const cooldownRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const resetTimeoutRef = useRef(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;

    dwellStartRef.current = null;

    setDwelling(false);
    setPct(0);
  }, []);

  useEffect(() => {
    const handleGaze = (e) => {
      if (cooldownRef.current) return;
      if (!onSelectRef.current) return;

      const { x, y } = e.detail;

      const el = targetRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) return;

      const PADDING = 40;

      const inside =
        x >= rect.left - PADDING &&
        x <= rect.right + PADDING &&
        y >= rect.top - PADDING &&
        y <= rect.bottom + PADDING;

      if (inside) {
        if (resetTimeoutRef.current) {
          clearTimeout(resetTimeoutRef.current);
          resetTimeoutRef.current = null;
        }

        if (!dwellStartRef.current) {
          dwellStartRef.current = Date.now();

          intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - dwellStartRef.current;

            const progress = Math.min(
              (elapsed / dwellMs) * 100,
              100
            );

            setDwelling(true);
            setPct(progress);

            if (progress >= 100) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;

              cooldownRef.current = true;

              onSelectRef.current?.();

              reset();

              setTimeout(() => {
                cooldownRef.current = false;
              }, COOLDOWN_MS);
            }
          }, 30);
        }
      } else {
        if (dwellStartRef.current && !resetTimeoutRef.current) {
          resetTimeoutRef.current = setTimeout(() => {
            reset();
            resetTimeoutRef.current = null;
          }, 400);
        }
      }
    };

    window.addEventListener("gaze-update", handleGaze);

    return () => {
      window.removeEventListener("gaze-update", handleGaze);

      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      reset();
    };
  }, [targetRef, dwellMs, reset]);

  return { dwelling, pct };
}