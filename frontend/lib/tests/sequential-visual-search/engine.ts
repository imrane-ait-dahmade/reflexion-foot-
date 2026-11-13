import { SEQUENTIAL_TOTAL } from "./layout";

export type SearchState = {
  target: number;
  found: number;
  errors: number;
  completed: boolean;
  completionTimeMs: number | null;
};

export type SelectionOutcome = {
  kind: "correct" | "wrong" | "ignored";
  state: SearchState;
};

export function initialSearchState(): SearchState {
  return {
    target: 1,
    found: 0,
    errors: 0,
    completed: false,
    completionTimeMs: null,
  };
}

export function applySelection(
  state: SearchState,
  number: number,
  elapsedMs: number,
): SelectionOutcome {
  if (
    state.completed ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > SEQUENTIAL_TOTAL
  ) {
    return { kind: "ignored", state };
  }
  if (number < state.target) {
    return { kind: "ignored", state };
  }
  if (number !== state.target) {
    return {
      kind: "wrong",
      state: { ...state, errors: state.errors + 1 },
    };
  }

  const found = state.found + 1;
  if (found === SEQUENTIAL_TOTAL) {
    return {
      kind: "correct",
      state: {
        target: SEQUENTIAL_TOTAL + 1,
        found,
        errors: state.errors,
        completed: true,
        completionTimeMs: Math.max(0, Math.round(elapsedMs)),
      },
    };
  }

  return {
    kind: "correct",
    state: {
      ...state,
      target: state.target + 1,
      found,
    },
  };
}
