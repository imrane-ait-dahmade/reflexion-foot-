"use client";

import { useCallback, useEffect, useState } from "react";

const COUNTDOWN_SECONDS = 3;

/**
 * Shows a short countdown before calling `onStart`, so the player can prepare
 * and avoid accidental first taps.
 */
export function useCountdownStart(onStart: () => void) {
  const [count, setCount] = useState<number | null>(null);
  const isCounting = count !== null;

  const begin = useCallback(() => {
    setCount(COUNTDOWN_SECONDS);
  }, []);

  const cancel = useCallback(() => {
    setCount(null);
  }, []);

  useEffect(() => {
    if (count === null) return;

    if (count === 0) {
      const id = window.setTimeout(() => {
        setCount(null);
        onStart();
      }, 450);
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => {
      setCount((current) => (current === null ? null : current - 1));
    }, 900);

    return () => window.clearTimeout(id);
  }, [count, onStart]);

  return { begin, cancel, count, isCounting };
}
