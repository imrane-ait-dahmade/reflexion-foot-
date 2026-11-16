"use client";

import { useCallback } from "react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { playersService } from "@/lib/api/players.service";
import type { PositionResponse } from "@/lib/api/types";

export function usePositions(options: { enabled?: boolean } = {}) {
  const loader = useCallback(
    (signal: AbortSignal) => playersService.listPositions(signal),
    [],
  );
  return useAsyncResource<PositionResponse[]>(loader, options);
}
