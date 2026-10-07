import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import {
  PERIPHERAL_VISION_CONFIG,
  TIMER_TICK_MS,
} from "@/lib/tests/peripheral-vision/config";
import {
  randomPeripheralPosition,
  randomTrialInterval,
} from "@/lib/tests/peripheral-vision/positions";
import type {
  PeripheralPosition,
  PeripheralVisionTestResult,
  Side,
  SideStats,
  TrialPhase,
} from "@/lib/tests/peripheral-vision/types";
import { buildPeripheralVisionResult } from "@/lib/tests/scoring";
import type { TestPhase } from "@/lib/tests/types";

const { durationMs, stimulusVisibleMs } = PERIPHERAL_VISION_CONFIG;

type State = {
  phase: TestPhase;
  /** Incremented on every start so a restart always gets a fresh timer. */
  runId: number;
  trialPhase: TrialPhase;
  /**
   * Incremented on every trial phase change. Actions carry the id they were
   * created for, so stale timers and duplicate answers are ignored.
   */
  trialId: number;
  intervalMs: number;
  position: PeripheralPosition | null;
  startedAt: number;
  elapsedMs: number;
  reactionTimes: number[];
  wrongAnswers: number;
  missed: number;
  sideStats: Record<Side, SideStats>;
  result: PeripheralVisionTestResult | null;
};

type Action =
  | { type: "start"; at: number; intervalMs: number }
  | { type: "tick"; at: number }
  | { type: "showStimulus"; at: number; trialId: number; position: PeripheralPosition }
  | { type: "miss"; at: number; trialId: number; nextIntervalMs: number }
  | {
      type: "respond";
      at: number;
      trialId: number;
      side: Side;
      reactionTime: number;
      nextIntervalMs: number;
    };

const emptySideStats = (): Record<Side, SideStats> => ({
  left: { trials: 0, correct: 0 },
  right: { trials: 0, correct: 0 },
});

const initialState: State = {
  phase: "idle",
  runId: 0,
  trialPhase: "interval",
  trialId: 0,
  intervalMs: 0,
  position: null,
  startedAt: 0,
  elapsedMs: 0,
  reactionTimes: [],
  wrongAnswers: 0,
  missed: 0,
  sideStats: emptySideStats(),
  result: null,
};

function finish(state: State): State {
  return {
    ...state,
    phase: "finished",
    elapsedMs: durationMs,
    position: null,
    trialId: state.trialId + 1,
    result: buildPeripheralVisionResult({
      reactionTimes: state.reactionTimes,
      wrongAnswers: state.wrongAnswers,
      missed: state.missed,
      sideStats: state.sideStats,
      duration: durationMs,
    }),
  };
}

/** Closes the current trial and schedules the next one. */
function endTrial(
  state: State,
  outcome: "correct" | "wrong" | "missed",
  nextIntervalMs: number,
): State {
  const side = state.position?.side;
  const sideStats = side
    ? {
        ...state.sideStats,
        [side]: {
          trials: state.sideStats[side].trials + 1,
          correct:
            state.sideStats[side].correct + (outcome === "correct" ? 1 : 0),
        },
      }
    : state.sideStats;

  return {
    ...state,
    trialPhase: "interval",
    trialId: state.trialId + 1,
    intervalMs: nextIntervalMs,
    position: null,
    sideStats,
    wrongAnswers: state.wrongAnswers + (outcome === "wrong" ? 1 : 0),
    missed: state.missed + (outcome === "missed" ? 1 : 0),
  };
}

function reducer(state: State, action: Action): State {
  if (action.type === "start") {
    return {
      ...initialState,
      sideStats: emptySideStats(),
      phase: "running",
      runId: state.runId + 1,
      trialId: state.trialId + 1,
      intervalMs: action.intervalMs,
      startedAt: action.at,
    };
  }

  if (state.phase !== "running") return state;

  const elapsed = action.at - state.startedAt;
  if (elapsed >= durationMs) return finish(state);

  if (action.type === "tick") return { ...state, elapsedMs: elapsed };
  if (action.trialId !== state.trialId) return state;

  switch (action.type) {
    case "showStimulus":
      if (state.trialPhase !== "interval") return state;
      return {
        ...state,
        trialPhase: "stimulus",
        trialId: state.trialId + 1,
        position: action.position,
      };

    case "miss":
      if (state.trialPhase !== "stimulus") return state;
      return endTrial(state, "missed", action.nextIntervalMs);

    case "respond": {
      if (state.trialPhase !== "stimulus" || !state.position) return state;
      if (action.side !== state.position.side) {
        return endTrial(state, "wrong", action.nextIntervalMs);
      }
      return endTrial(
        { ...state, reactionTimes: [...state.reactionTimes, action.reactionTime] },
        "correct",
        action.nextIntervalMs,
      );
    }
  }
}

export function usePeripheralVisionTest() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { phase, runId, trialPhase, trialId, intervalMs } = state;
  const stimulusAtRef = useRef(0);

  // Runs right before the browser paints the target.
  useLayoutEffect(() => {
    if (phase === "running" && trialPhase === "stimulus") {
      stimulusAtRef.current = performance.now();
    }
  }, [phase, trialPhase, trialId]);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      dispatch({ type: "tick", at: performance.now() });
    }, TIMER_TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, runId]);

  // A single trial timeout at a time: the pause before the target, or the
  // target's visible window. Cleared on every phase change, restart and unmount.
  useEffect(() => {
    if (phase !== "running") return;

    const id =
      trialPhase === "interval"
        ? window.setTimeout(() => {
            dispatch({
              type: "showStimulus",
              at: performance.now(),
              trialId,
              position: randomPeripheralPosition(),
            });
          }, intervalMs)
        : window.setTimeout(() => {
            dispatch({
              type: "miss",
              at: performance.now(),
              trialId,
              nextIntervalMs: randomTrialInterval(),
            });
          }, stimulusVisibleMs);

    return () => window.clearTimeout(id);
  }, [phase, trialPhase, trialId, intervalMs]);

  const start = useCallback(() => {
    dispatch({
      type: "start",
      at: performance.now(),
      intervalMs: randomTrialInterval(),
    });
  }, []);

  const respond = useCallback(
    (side: Side) => {
      const now = performance.now();
      dispatch({
        type: "respond",
        at: now,
        trialId,
        side,
        reactionTime: now - stimulusAtRef.current,
        nextIntervalMs: randomTrialInterval(),
      });
    },
    [trialId],
  );

  return {
    phase,
    position: state.position,
    remainingMs: Math.max(0, durationMs - state.elapsedMs),
    correctAnswers: state.reactionTimes.length,
    wrongAnswers: state.wrongAnswers,
    missed: state.missed,
    result: state.result,
    start,
    respond,
  };
}
