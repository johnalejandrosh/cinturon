"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number from its previous value to `target` with an ease-out cubic
 * curve. Drives the "live" KPI counters. Respects `prefers-reduced-motion`.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const from = fromRef.current;
    const to = target;
    if (reduce || from === to) {
      fromRef.current = to;
      setValue(to);
      return;
    }

    let start: number | null = null;
    const tick = (now: number) => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      setValue(from + (to - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  return value;
}
