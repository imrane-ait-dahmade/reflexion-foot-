"use client";

import { useCallback } from "react";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { exercisesService } from "@/lib/api/exercises.service";
import type { CognitiveTestResponse } from "@/lib/api/types";

/** Loads FastAPI cognitive-tests catalogue (staff JWT required). */
export function useExercises(options: { enabled?: boolean } = {}) {
  const loader = useCallback(
    (signal: AbortSignal) => exercisesService.listCognitiveTests(signal),
    [],
  );

  return useAsyncResource<CognitiveTestResponse[]>(loader, options);
}
