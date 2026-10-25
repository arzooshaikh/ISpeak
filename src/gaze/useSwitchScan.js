import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_INTERVAL = 1500; // ms between highlights

/**
 * useSwitchScan — cycles through options sequentially.
 * A voluntary blink (via useBlink) selects the current option.
 *
 * Usage:
 *   const { activeIndex, activate } = useSwitchScan(options, onSelect);
 *   // call activate() from useBlink's onBlink callback
 */
export function useSwitchScan(options = [], onSelect, intervalMs = DEFAULT_INTERVAL) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [running, setRunning]         = useState(false);
  const indexRef                      = useRef(0);
  const timerRef                      = useRef(null);

  const stop  = useCallback(() => { clearInterval(timerRef.current); setRunning(false); }, []);
  const start = useCallback(() => {
    if (!options.length) return;
    setRunning(true);
    timerRef.current = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % options.length;
      setActiveIndex(indexRef.current);
    }, intervalMs);
  }, [options.length, intervalMs]);

  const activate = useCallback(() => {
    if (!running) return;
    onSelect?.(options[indexRef.current], indexRef.current);
  }, [running, options, onSelect]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  return { activeIndex, running, start, stop, activate };
}
