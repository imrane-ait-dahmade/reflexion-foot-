"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SaveResultEffect } from "@/components/sessions/SaveResultEffect";
import { NumberField } from "@/components/tests/sequential-visual-search/NumberField";
import { CountdownOverlay } from "@/components/tests/shared/CountdownOverlay";
import { ExerciseIntro } from "@/components/tests/shared/ExerciseIntro";
import { Button } from "@/components/ui/Button";
import { useCountdownStart } from "@/hooks/useCountdownStart";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { formatSeconds } from "@/lib/format";
import {
  applySelection,
  initialSearchState,
  type SearchState,
} from "@/lib/tests/sequential-visual-search/engine";
import { layoutForSession } from "@/lib/tests/sequential-visual-search/layout";
import { buildSequentialResult } from "@/lib/tests/sequential-visual-search/result";

type SequentialVisualSearchTestProps = {
  sessionPlayerId: string;
  sessionId: string;
  stepIndex?: number;
  stepTotal?: number;
};

export function SequentialVisualSearchTest({
  sessionPlayerId,
  sessionId,
  stepIndex,
  stepTotal,
}: SequentialVisualSearchTestProps) {
  const layout = useMemo(() => layoutForSession(sessionId), [sessionId]);
  const stateRef = useRef<SearchState>(initialSearchState());
  const startMark = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [state, setState] = useState<SearchState>(initialSearchState());
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);

  const beginRunning = useCallback(() => {
    stateRef.current = initialSearchState();
    setState(stateRef.current);
    setElapsed(0);
    setFlash(null);
    startMark.current = performance.now();
    setPhase("running");
  }, []);
  const countdown = useCountdownStart(beginRunning);
  const running = phase === "running";

  useLeaveGuard(running || countdown.isCounting);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (startMark.current == null || stateRef.current.completed) return;
      setElapsed(performance.now() - startMark.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    return () => {
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  const pick = (number: number) => {
    if (startMark.current == null || stateRef.current.completed) return;
    const elapsedMs = performance.now() - startMark.current;
    const outcome = applySelection(stateRef.current, number, elapsedMs);
    if (outcome.kind === "ignored") return;
    stateRef.current = outcome.state;
    setState(outcome.state);
    if (outcome.kind === "wrong") {
      setFlash(number);
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 350);
    }
    if (outcome.state.completed) {
      setElapsed(outcome.state.completionTimeMs ?? elapsedMs);
      setPhase("finished");
    }
  };

  if (phase === "finished") {
    const result = buildSequentialResult(state);
    if (!result) return null;
    return (
      <SaveResultEffect
        sessionPlayerId={sessionPlayerId}
        testSlug="sequential-visual-search"
        result={result}
        metrics={result.metrics}
      />
    );
  }

  return (
    <section className="relative flex flex-col gap-4">
      <CountdownOverlay count={countdown.count} onCancel={countdown.cancel} allowCancel={false} />
      {phase === "idle" ? (
        <ExerciseIntro
          slug="sequential-visual-search"
          title="Recherche Visuelle Séquentielle"
          tip="De 1 jusqu'à 50, sans sauter."
          stepIndex={stepIndex}
          stepTotal={stepTotal}
        >
          <p className="text-center text-sm text-muted">
            Retrouvez les nombres dans l&apos;ordre, de 1 à 50.
          </p>
          <Button onClick={countdown.begin} disabled={countdown.isCounting}>
            Démarrer l&apos;exercice
          </Button>
        </ExerciseIntro>
      ) : null}
      {running ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg border border-border bg-surface px-2 py-2">
              <p className="text-xs text-muted">Nombre</p>
              <p className="text-xl font-bold tabular-nums text-brand">{state.target}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-2 py-2">
              <p className="text-xs text-muted">Temps</p>
              <p className="text-xl font-bold tabular-nums">{formatSeconds(elapsed)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-2 py-2">
              <p className="text-xs text-muted">Progression</p>
              <p className="text-xl font-bold tabular-nums">{state.found}/50</p>
            </div>
          </div>
          <p className="text-center text-sm text-muted">
            Retrouvez les nombres dans l&apos;ordre, de 1 à 50.
          </p>
          <NumberField
            layout={layout}
            foundUntil={state.target}
            flash={flash}
            disabled={false}
            onPick={pick}
          />
          <p className="text-center text-sm text-muted">{state.errors} erreur(s)</p>
        </>
      ) : null}
    </section>
  );
}
