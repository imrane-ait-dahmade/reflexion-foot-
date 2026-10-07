import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import { REACTION_TIME_CONFIG } from "@/lib/tests/reaction-time/config";
import { randomStimulusDelay } from "@/lib/tests/reaction-time/delay";
import type {
  ReactionAttemptPhase,
  ReactionTimeTestResult,
} from "@/lib/tests/reaction-time/types";
import { buildReactionTimeResult } from "@/lib/tests/scoring";
import type { TestPhase } from "@/lib/tests/types";

const { attempts, tooEarlyMs } = REACTION_TIME_CONFIG;

type State = {
  phase: TestPhase;
  attemptPhase: ReactionAttemptPhase;
  /**
   * Incremented on every phase change of an attempt. Actions carry the id they
   * were created for, so stale timers or duplicate taps are ignored.
   */
  attemptId: number;
  delayMs: number;
  startedAt: number;
  reactionTimes: number[];
  falseStarts: number;
  result: ReactionTimeTestResult | null;
};

type Action =
  | { type: "start"; at: number; delayMs: number }
  | { type: "showStimulus"; attemptId: number }
  | { type: "hit"; attemptId: number; reactionTime: number; at: number; nextDelayMs: number }
  | { type: "falseStart"; attemptId: number }
  | { type: "retry"; attemptId: number; delayMs: number };

const initialState: State = {
  phase: "idle",
  attemptPhase: "waiting",
  attemptId: 0,
  delayMs: 0,
  startedAt: 0,
  reactionTimes: [],
  falseStarts: 0,
  result: null,
};

function reducer(state: State, action: Action): State {
  if (action.type === "start") {
    return {
      ...initialState,
      phase: "running",
      attemptId: state.attemptId + 1,
      delayMs: action.delayMs,
      startedAt: action.at,
    };
  }

  if (state.phase !== "running" || action.attemptId !== state.attemptId) {
    return state;
  }

  switch (action.type) {
    case "showStimulus":
      if (state.attemptPhase !== "waiting") return state;
      return { ...state, attemptPhase: "stimulus", attemptId: state.attemptId + 1 };

    case "falseStart":
      if (state.attemptPhase !== "waiting") return state;
      return {
        ...state,
        attemptPhase: "tooEarly",
        attemptId: state.attemptId + 1,
        falseStarts: state.falseStarts + 1,
      };

    case "retry":
      if (state.attemptPhase !== "tooEarly") return state;
      return {
        ...state,
        attemptPhase: "waiting",
        attemptId: state.attemptId + 1,
        delayMs: action.delayMs,
      };

    case "hit": {
      if (state.attemptPhase !== "stimulus") return state;
      const reactionTimes = [...state.reactionTimes, action.reactionTime];
      if (reactionTimes.length >= attempts) {
        return {
          ...state,
          phase: "finished",
          attemptId: state.attemptId + 1,
          reactionTimes,
          result: buildReactionTimeResult({
            reactionTimes,
            falseStarts: state.falseStarts,
            duration: action.at - state.startedAt,
          }),
        };
      }
      return {
        ...state,
        attemptPhase: "waiting",
        attemptId: state.attemptId + 1,
        delayMs: action.nextDelayMs,
        reactionTimes,
      };
    }
  }
}

export function useReactionTimeTest() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { phase, attemptPhase, attemptId, delayMs } = state;
  const stimulusAtRef = useRef(0);

  // Runs right before the browser paints the stimulus.
  useLayoutEffect(() => {
    if (phase === "running" && attemptPhase === "stimulus") {
      stimulusAtRef.current = performance.now();
    }
  }, [phase, attemptPhase, attemptId]);

  // A single timeout at a time: the wait before the stimulus, or the
  // "Too early!" pause. Cleared on every phase change, restart and unmount.
  useEffect(() => {
    if (phase !== "running") return;

    let id: number;
    if (attemptPhase === "waiting") {
      id = window.setTimeout(() => {
        dispatch({ type: "showStimulus", attemptId });
      }, delayMs);
    } else if (attemptPhase === "tooEarly") {
      id = window.setTimeout(() => {
        dispatch({ type: "retry", attemptId, delayMs: randomStimulusDelay() });
      }, tooEarlyMs);
    } else {
      return;
    }
    return () => window.clearTimeout(id);
  }, [phase, attemptPhase, attemptId, delayMs]);

  const start = useCallback(() => {
    dispatch({
      type: "start",
      at: performance.now(),
      delayMs: randomStimulusDelay(),
    });
  }, []);

  const pressTarget = useCallback(() => {
    const now = performance.now();
    dispatch({
      type: "hit",
      attemptId,
      reactionTime: now - stimulusAtRef.current,
      at: now,
      nextDelayMs: randomStimulusDelay(),
    });
  }, [attemptId]);

  const pressArea = useCallback(() => {
    dispatch({ type: "falseStart", attemptId });
  }, [attemptId]);

  const { reactionTimes } = state;
  return {
    phase,
    attemptPhase,
    currentAttempt: Math.min(reactionTimes.length + 1, attempts),
    totalAttempts: attempts,
    lastReactionTime: reactionTimes.at(-1) ?? 0,
    falseStarts: state.falseStarts,
    result: state.result,
    start,
    pressTarget,
    pressArea,
  };
}
