import { useCallback, useEffect, useReducer } from "react";
import {
  TIMER_TICK_MS,
  VISUAL_MEMORY_CONFIG,
} from "@/lib/tests/visual-memory/config";
import { createRoundTargets } from "@/lib/tests/visual-memory/rounds";
import type {
  VisualMemoryRoundPhase,
  VisualMemoryTestResult,
} from "@/lib/tests/visual-memory/types";
import { buildVisualMemoryResult } from "@/lib/tests/scoring";
import type { TestPhase } from "@/lib/tests/types";

const { durationMs, memorizeMs, targetsPerRound } = VISUAL_MEMORY_CONFIG;

type State = {
  phase: TestPhase;
  /** Incremented on every start so a restart always gets a fresh timer. */
  runId: number;
  /** Incremented on every new round to re-arm the memorization timer. */
  roundId: number;
  roundPhase: VisualMemoryRoundPhase;
  targets: number[];
  /** Correct cells already selected in the current round. */
  selected: number[];
  startedAt: number;
  answerStartedAt: number;
  elapsedMs: number;
  roundsCompleted: number;
  correctCells: number;
  wrongClicks: number;
  responseTimes: number[];
  wrongFlash: { index: number; id: number } | null;
  result: VisualMemoryTestResult | null;
};

type Action =
  | { type: "start"; at: number; targets: number[] }
  | { type: "memorizeEnd"; at: number }
  | { type: "press"; index: number; at: number; nextTargets: number[] }
  | { type: "tick"; at: number };

const initialState: State = {
  phase: "idle",
  runId: 0,
  roundId: 0,
  roundPhase: "memorize",
  targets: [],
  selected: [],
  startedAt: 0,
  answerStartedAt: 0,
  elapsedMs: 0,
  roundsCompleted: 0,
  correctCells: 0,
  wrongClicks: 0,
  responseTimes: [],
  wrongFlash: null,
  result: null,
};

function finish(state: State): State {
  return {
    ...state,
    phase: "finished",
    elapsedMs: durationMs,
    wrongFlash: null,
    result: buildVisualMemoryResult({
      roundsCompleted: state.roundsCompleted,
      correctCells: state.correctCells,
      wrongClicks: state.wrongClicks,
      responseTimes: state.responseTimes,
      duration: durationMs,
    }),
  };
}

function startRound(state: State, targets: number[]): State {
  return {
    ...state,
    roundId: state.roundId + 1,
    roundPhase: "memorize",
    targets,
    selected: [],
    wrongFlash: null,
  };
}

function press(state: State, index: number, at: number, nextTargets: number[]) {
  if (state.roundPhase !== "answer" || state.selected.includes(index)) {
    return state;
  }

  if (!state.targets.includes(index)) {
    return {
      ...state,
      wrongClicks: state.wrongClicks + 1,
      wrongFlash: { index, id: (state.wrongFlash?.id ?? 0) + 1 },
    };
  }

  const selected = [...state.selected, index];
  const next = { ...state, selected, correctCells: state.correctCells + 1 };
  if (selected.length < targetsPerRound) return next;

  return startRound(
    {
      ...next,
      roundsCompleted: state.roundsCompleted + 1,
      responseTimes: [...state.responseTimes, at - state.answerStartedAt],
    },
    nextTargets,
  );
}

function reducer(state: State, action: Action): State {
  if (action.type === "start") {
    return startRound(
      {
        ...initialState,
        phase: "running",
        runId: state.runId + 1,
        roundId: state.roundId,
        startedAt: action.at,
      },
      action.targets,
    );
  }

  if (state.phase !== "running") return state;

  const elapsed = action.at - state.startedAt;
  if (elapsed >= durationMs) return finish(state);

  switch (action.type) {
    case "tick":
      return { ...state, elapsedMs: elapsed };
    case "memorizeEnd":
      return { ...state, roundPhase: "answer", answerStartedAt: action.at };
    case "press":
      return press(state, action.index, action.at, action.nextTargets);
  }
}

export function useVisualMemoryTest() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { phase, runId, roundId, roundPhase } = state;

  const start = useCallback(() => {
    dispatch({
      type: "start",
      at: performance.now(),
      targets: createRoundTargets(),
    });
  }, []);

  const pressCell = useCallback((index: number) => {
    dispatch({
      type: "press",
      index,
      at: performance.now(),
      nextTargets: createRoundTargets(),
    });
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      dispatch({ type: "tick", at: performance.now() });
    }, TIMER_TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, runId]);

  useEffect(() => {
    if (phase !== "running" || roundPhase !== "memorize") return;
    const id = window.setTimeout(() => {
      dispatch({ type: "memorizeEnd", at: performance.now() });
    }, memorizeMs);
    return () => window.clearTimeout(id);
  }, [phase, roundPhase, roundId]);

  return {
    phase,
    roundPhase,
    targets: state.targets,
    selected: state.selected,
    remainingMs: Math.max(0, durationMs - state.elapsedMs),
    roundsCompleted: state.roundsCompleted,
    correctCells: state.correctCells,
    wrongClicks: state.wrongClicks,
    wrongFlash: state.wrongFlash,
    result: state.result,
    start,
    pressCell,
  };
}
