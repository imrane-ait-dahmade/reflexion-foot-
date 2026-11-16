"use client";

import { useCallback, useEffect, useState } from "react";
import { isApiError } from "@/lib/api/errors";

export type AsyncResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

/**
 * Shared loader with AbortController cleanup — used by domain hooks.
 * Pass a stable `loader` (e.g. useCallback) so requests are not duplicated.
 */
export function useAsyncResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  options: { enabled?: boolean } = {},
): AsyncResourceState<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    });

    loader(controller.signal)
      .then((result) => {
        if (!active) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        const message = isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "Request failed";
        setError(message);
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, tick, loader]);

  return { data, error, loading, reload };
}
