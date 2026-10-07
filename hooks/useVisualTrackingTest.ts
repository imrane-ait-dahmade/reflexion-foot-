import { useCallback, useEffect, useReducer } from "react";
import {
  TIMER_TICK_MS,
  VISUAL_TRACKING_CONFIG,
} from "@/lib/tests/visual-tracking/config";
import {
  createTrackingNumbers,
  pickNextTarget,
} from "@/lib/tests/visual-tracking/targets";
import type { VisualTrackingTestResult } from "@/lib/tests/visual-tracking/types";
import { buildVisualTrackingResult } from "@/lib/tests/scoring";
import type { TestPhase } from "@/lib/tests/types";

const { durationMs } = VISUAL_TRACKING_CONFIG;

type State = {
  phase: TestPhase;
  /** Incremented on every start so a restart always gets a fresh timer. */
  runId: number;
  numbers: number[];
  targetNumber: number | null;
  startedAt: number;
  /** Reaction time for the current target is measured from this moment. */
  targetShownAt: number;
  elapsedMs: number;
  reactionTimes: number[];
  wrongClicks: number;
  result: VisualTrackingTestResult | null;
};

type Action =
  | { type: "start"; at: number; numbers: number[]; targetNumber: number }
  | { type: "press"; value: number; at: number; rand: number }
  | { type: "tick"; at: number };

const initialState: State = {
  phase: "idle",
  runId: 0,
  numbers: [],
  targetNumber: null,
  startedAt: 0,
  targetShownAt: 0,
  elapsedMs: 0,
  reactionTimes: [],
  wrongClicks: 0,
  result: null,
};

function finish(state: State): State {
  return {
    ...state,
    phase: "finished",
    elapsedMs: durationMs,
    result: buildVisualTrackingResult({
      reactionTimes: state.reactionTimes,
      wrongClicks: state.wrongClicks,
      duration: durationMs,
    }),
  };
}

function reducer(state: State, action: Action): State {
  if (action.type === "start") {
    return {
      ...initialState,
      phase: "running",
      runId: state.runId + 1,
      numbers: action.numbers,
      targetNumber: action.targetNumber,
      startedAt: action.at,
      targetShownAt: action.at,
    };
  }

  if (state.phase !== "running" || state.targetNumber === null) return state;

  const elapsed = action.at - state.startedAt;
  if (elapsed >= durationMs) return finish(state);

  if (action.type === "tick") return { ...state, elapsedMs: elapsed };

  if (action.value !== state.targetNumber) {
    return { ...state, wrongClicks: state.wrongClicks + 1 };
  }

  return {
    ...state,
    reactionTimes: [...state.reactionTimes, action.at - state.targetShownAt],
    targetNumber: pickNextTarget(state.numbers, state.targetNumber, action.rand),
    targetShownAt: action.at,
  };
}

export function useVisualTrackingTest() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { phase, runId, targetNumber } = state;

  const start = useCallback(() => {
    dispatch({ type: "start", at: performance.now(), ...createTrackingNumbers() });
  }, []);

  const pressNumber = useCallback((value: number) => {
    dispatch({
      type: "press",
      value,
      at: performance.now(),
      rand: Math.random(),
    });
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      dispatch({ type: "tick", at: performance.now() });
    }, TIMER_TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, runId]);

  return {
    phase,
    numbers: state.numbers,
    targetNumber,
    remainingMs: Math.max(0, durationMs - state.elapsedMs),
    targetsFound: state.reactionTimes.length,
    wrongClicks: state.wrongClicks,
    result: state.result,
    start,
    pressNumber,
  };
}
