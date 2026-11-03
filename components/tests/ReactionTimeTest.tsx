"use client";

import { Button } from "@/components/ui/Button";
import { CountdownOverlay } from "@/components/tests/shared/CountdownOverlay";
import { StatCard } from "@/components/tests/shared/StatCard";
import { TestInstructions } from "@/components/tests/shared/TestInstructions";
import { TestResults } from "@/components/tests/shared/TestResults";
import { useCountdownStart } from "@/hooks/useCountdownStart";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useReactionTimeTest } from "@/hooks/useReactionTimeTest";
import { formatMs } from "@/lib/format";
import { SaveResultEffect } from "@/components/sessions/SaveResultEffect";
import {
  REACTION_TIME_CONFIG,
  REACTION_TIME_SCORING,
} from "@/lib/tests/reaction-time/config";

const { attempts, minDelayMs, maxDelayMs } = REACTION_TIME_CONFIG;

type ReactionTimeTestProps = {
  sessionPlayerId?: string;
};

export function ReactionTimeTest({
  sessionPlayerId,
}: ReactionTimeTestProps = {}) {
  const test = useReactionTimeTest();
  const countdown = useCountdownStart(test.start);
  const isRunning = test.phase === "running";
  const sessionMode = Boolean(sessionPlayerId);

  useLeaveGuard(isRunning || countdown.isCounting);

  if (test.phase === "finished" && test.result) {
    const { result } = test;
    return (
      <div className="flex flex-col gap-3">
        {sessionPlayerId && (
          <SaveResultEffect
            sessionPlayerId={sessionPlayerId}
            testSlug="reaction-time"
            result={result}
            metrics={{
              attempts: result.attempts,
              falseStarts: result.falseStarts,
              worstReactionTime: result.worstReactionTime,
            }}
          />
        )}
        <TestResults
          title="Résultat — Temps de réaction"
          score={`${result.score} / ${REACTION_TIME_SCORING.maxScore}`}
          onRestart={test.start}
          sessionMode={sessionMode}
          items={[
            { label: "Essais", value: String(result.attempts) },
            { label: "Faux départs", value: String(result.falseStarts) },
            { label: "Moyenne", value: formatMs(result.averageReactionTime) },
            { label: "Meilleur", value: formatMs(result.bestReactionTime) },
            { label: "Pire", value: formatMs(result.worstReactionTime) },
          ]}
        />
      </div>
    );
  }

  const waiting = isRunning && test.attemptPhase === "waiting";
  const tooEarly = isRunning && test.attemptPhase === "tooEarly";
  const stimulus = isRunning && test.attemptPhase === "stimulus";

  return (
    <section className="flex flex-col gap-4">
      {!isRunning && !countdown.isCounting && (
        <TestInstructions
          tip="Ne touche l'écran QUE quand le cercle vert apparaît. Trop tôt = faux départ."
          steps={[
            `Attends pendant « ATTENDS… » (${minDelayMs / 1000} à ${maxDelayMs / 1000} s).`,
            "Touche le cercle dès qu'il apparaît, le plus vite possible.",
            "Toucher trop tôt est un faux départ : l'essai recommence.",
            `Le test se termine après ${attempts} réactions réussies.`,
          ]}
        />
      )}

      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Essai"
          value={isRunning ? `${test.currentAttempt} / ${test.totalAttempts}` : "—"}
        />
        <StatCard label="Dernier" value={formatMs(test.lastReactionTime)} />
        <StatCard label="Faux départs" value={test.falseStarts} />
      </div>

      <div className="relative">
        <CountdownOverlay count={countdown.count} onCancel={countdown.cancel} />
        <div
          onPointerDown={(event) => {
            if (event.button !== 0 || !isRunning) return;
            event.preventDefault();
            test.pressArea();
          }}
          className={`flex aspect-square w-full touch-manipulation select-none items-center justify-center rounded-xl border sm:aspect-[4/3] ${
            waiting
              ? "border-danger/50 bg-danger/10"
              : tooEarly
                ? "border-danger bg-danger/20"
                : stimulus
                  ? "border-brand/50 bg-brand-soft"
                  : "border-border bg-surface"
          }`}
        >
          {!isRunning && !countdown.isCounting && (
            <span className="text-muted">Appuie sur Commencer</span>
          )}
          {waiting && (
            <span className="text-3xl font-bold tracking-wide text-danger">
              ATTENDS…
            </span>
          )}
          {tooEarly && (
            <div className="flex flex-col items-center gap-1 px-4 text-center">
              <span className="text-3xl font-bold text-danger">Trop tôt !</span>
              <span className="text-sm text-muted">
                Attends le cercle avant de toucher.
              </span>
            </div>
          )}
          {stimulus && (
            <button
              type="button"
              aria-label="Cible de réaction"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                test.pressTarget();
              }}
              onClick={(event) => {
                if (event.detail === 0) test.pressTarget();
              }}
              className="size-40 rounded-full bg-brand shadow-[0_0_0_8px_rgb(0_128_96_/_0.25)] sm:size-48"
            />
          )}
        </div>
      </div>

      {!isRunning && !countdown.isCounting && (
        <Button onClick={countdown.begin}>Commencer</Button>
      )}
    </section>
  );
}
