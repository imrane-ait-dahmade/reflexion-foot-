"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { CountdownOverlay } from "@/components/tests/shared/CountdownOverlay";
import { ExerciseIntro } from "@/components/tests/shared/ExerciseIntro";
import { StatCard } from "@/components/tests/shared/StatCard";
import { TestInstructions } from "@/components/tests/shared/TestInstructions";
import { TestResults } from "@/components/tests/shared/TestResults";
import { useCountdownStart } from "@/hooks/useCountdownStart";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { usePeripheralVisionTest } from "@/hooks/usePeripheralVisionTest";
import { formatMs, formatPercent, formatSeconds } from "@/lib/format";
import {
  PERIPHERAL_VISION_CONFIG,
  PERIPHERAL_VISION_SCORING,
} from "@/lib/tests/peripheral-vision/config";
import { SaveResultEffect } from "@/components/sessions/SaveResultEffect";
import type { Side } from "@/lib/tests/peripheral-vision/types";

const { durationMs, stimulusVisibleMs } = PERIPHERAL_VISION_CONFIG;

const DISCLAIMER =
  "Exercice de performance, pas un bilan médical ou ophtalmologique.";

const RESPONSE_BUTTONS: { side: Side; label: string }[] = [
  { side: "left", label: "GAUCHE" },
  { side: "right", label: "DROITE" },
];

type Feedback = "correct" | "wrong" | "missed";

type PeripheralVisionTestProps = {
  sessionPlayerId?: string;
  stepIndex?: number;
  stepTotal?: number;
};

export function PeripheralVisionTest({
  sessionPlayerId,
  stepIndex,
  stepTotal,
}: PeripheralVisionTestProps = {}) {
  const test = usePeripheralVisionTest();
  const countdown = useCountdownStart(test.start);
  const isRunning = test.phase === "running";
  const sessionMode = Boolean(sessionPlayerId);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [, startTransition] = useTransition();
  const prev = useRef({
    correct: 0,
    wrong: 0,
    missed: 0,
    running: false,
  });

  useLeaveGuard(isRunning || countdown.isCounting);

  useEffect(() => {
    if (!isRunning) {
      prev.current = { correct: 0, wrong: 0, missed: 0, running: false };
      return;
    }

    const wasRunning = prev.current.running;
    let next: Feedback | null = null;
    if (wasRunning) {
      if (test.correctAnswers > prev.current.correct) next = "correct";
      else if (test.wrongAnswers > prev.current.wrong) next = "wrong";
      else if (test.missed > prev.current.missed) next = "missed";
    }

    prev.current = {
      correct: test.correctAnswers,
      wrong: test.wrongAnswers,
      missed: test.missed,
      running: true,
    };

    if (!next) return;

    startTransition(() => setFeedback(next));
    const id = window.setTimeout(() => {
      startTransition(() => setFeedback(null));
    }, 450);
    return () => window.clearTimeout(id);
  }, [
    isRunning,
    startTransition,
    test.correctAnswers,
    test.wrongAnswers,
    test.missed,
  ]);

  if (test.phase === "finished" && test.result) {
    if (sessionMode && sessionPlayerId) {
      return (
        <SaveResultEffect
          sessionPlayerId={sessionPlayerId}
          testSlug="peripheral-vision"
          result={test.result}
          metrics={{
            trials: test.result.trials,
            missed: test.result.missed,
            wrongAnswers: test.result.wrongAnswers,
            leftAccuracy: test.result.leftAccuracy,
            rightAccuracy: test.result.rightAccuracy,
          }}
        />
      );
    }

    const { result } = test;
    return (
      <div className="flex flex-col gap-3">
        <TestResults
          title="Résultat — Vision périphérique"
          score={`${result.score} / ${PERIPHERAL_VISION_SCORING.maxScore}`}
          onRestart={test.start}
          items={[
            { label: "Essais", value: String(result.trials) },
            { label: "Corrects", value: String(result.correctAnswers) },
            { label: "Faux", value: String(result.wrongAnswers) },
            { label: "Manqués", value: String(result.missed) },
            { label: "Précision", value: formatPercent(result.accuracy) },
            {
              label: "Réaction moyenne",
              value: formatMs(result.averageReactionTime),
            },
            {
              label: "Meilleure réaction",
              value: formatMs(result.bestReactionTime),
            },
            {
              label: "Précision gauche",
              value: formatPercent(result.leftAccuracy),
            },
            {
              label: "Précision droite",
              value: formatPercent(result.rightAccuracy),
            },
          ]}
        />
        <p className="text-center text-xs text-muted">{DISCLAIMER}</p>
      </div>
    );
  }

  const activeFeedback = isRunning ? feedback : null;
  const feedbackLabel =
    activeFeedback === "correct"
      ? "Bien !"
      : activeFeedback === "wrong"
        ? "Mauvais côté"
        : activeFeedback === "missed"
          ? "Trop lent"
          : null;

  return (
    <section className="flex flex-col gap-4">
      {!isRunning && !countdown.isCounting && (
        <ExerciseIntro
          slug="peripheral-vision"
          title="Vision périphérique"
          tip="Fixe le + au centre. Réponds sans regarder la cible."
          stepIndex={stepIndex}
          stepTotal={stepTotal}
        >
          <TestInstructions
            steps={[
              "Yeux sur le + pendant tout le test.",
              `Une cible flash ${stimulusVisibleMs} ms sur un bord.`,
              `Réponds GAUCHE ou DROITE. Durée ${durationMs / 1000} s.`,
            ]}
          />
        </ExerciseIntro>
      )}

      {(isRunning || countdown.isCounting) && (
        <>
          <div className="grid grid-cols-4 gap-2">
            <StatCard label="Temps" value={formatSeconds(test.remainingMs)} />
            <StatCard label="Corrects" value={test.correctAnswers} />
            <StatCard label="Faux" value={test.wrongAnswers} />
            <StatCard label="Manqués" value={test.missed} />
          </div>

          <div className="relative">
            <CountdownOverlay
              count={countdown.count}
              onCancel={sessionMode ? undefined : countdown.cancel}
              allowCancel={!sessionMode}
            />
            <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-xl border border-border bg-surface">
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-bold leading-none"
              >
                +
              </span>
              {test.position && (
                <span
                  data-testid="peripheral-target"
                  className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand sm:size-10"
                  style={{
                    left: `${test.position.xPercent}%`,
                    top: `${test.position.yPercent}%`,
                  }}
                />
              )}
              {feedbackLabel && (
                <p
                  className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-semibold ${
                    activeFeedback === "correct"
                      ? "bg-brand-soft text-brand"
                      : "bg-danger/20 text-danger"
                  }`}
                >
                  {feedbackLabel}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {RESPONSE_BUTTONS.map(({ side, label }) => (
              <Button
                key={side}
                variant="secondary"
                disabled={!isRunning || countdown.isCounting}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  test.respond(side);
                }}
                onClick={(event) => {
                  if (event.detail === 0) test.respond(side);
                }}
                className="min-h-20 touch-manipulation select-none text-xl"
              >
                {label}
              </Button>
            ))}
          </div>
        </>
      )}

      {!isRunning && !countdown.isCounting && (
        <>
          <Button onClick={countdown.begin}>
            {sessionMode ? "Démarrer l'exercice" : "Commencer"}
          </Button>
          <p className="text-center text-xs text-muted">{DISCLAIMER}</p>
        </>
      )}
    </section>
  );
}
