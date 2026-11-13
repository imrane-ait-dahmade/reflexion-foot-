"use client";

import { Button } from "@/components/ui/Button";
import { CountdownOverlay } from "@/components/tests/shared/CountdownOverlay";
import { ExerciseIntro } from "@/components/tests/shared/ExerciseIntro";
import { StatCard } from "@/components/tests/shared/StatCard";
import { TestInstructions } from "@/components/tests/shared/TestInstructions";
import { TestResults } from "@/components/tests/shared/TestResults";
import { TrackingArea } from "@/components/tests/visual-tracking/TrackingArea";
import { useCountdownStart } from "@/hooks/useCountdownStart";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useVisualTrackingTest } from "@/hooks/useVisualTrackingTest";
import { formatMs, formatPercent, formatSeconds } from "@/lib/format";
import { SaveResultEffect } from "@/components/sessions/SaveResultEffect";
import {
  VISUAL_TRACKING_CONFIG,
  VISUAL_TRACKING_SCORING,
} from "@/lib/tests/visual-tracking/config";

const { itemCount, durationMs } = VISUAL_TRACKING_CONFIG;

type VisualTrackingTestProps = {
  sessionPlayerId?: string;
  stepIndex?: number;
  stepTotal?: number;
};

export function VisualTrackingTest({
  sessionPlayerId,
  stepIndex,
  stepTotal,
}: VisualTrackingTestProps = {}) {
  const test = useVisualTrackingTest();
  const countdown = useCountdownStart(test.start);
  const isRunning = test.phase === "running";
  const sessionMode = Boolean(sessionPlayerId);

  useLeaveGuard(isRunning || countdown.isCounting);

  if (test.phase === "finished" && test.result) {
    if (sessionMode && sessionPlayerId) {
      return (
        <SaveResultEffect
          sessionPlayerId={sessionPlayerId}
          testSlug="visual-tracking"
          result={test.result}
          metrics={{
            targetsFound: test.result.targetsFound,
            wrongClicks: test.result.errors,
            reactionTimes: test.result.reactionTimes,
          }}
        />
      );
    }

    const { result } = test;
    return (
      <TestResults
        title="Résultat — Suivi de numéros"
        score={`${result.score} / ${VISUAL_TRACKING_SCORING.maxScore}`}
        onRestart={test.start}
        items={[
          { label: "Cibles trouvées", value: String(result.targetsFound) },
          { label: "Faux clics", value: String(result.errors) },
          { label: "Précision", value: formatPercent(result.accuracy) },
          {
            label: "Réaction moyenne",
            value: formatMs(result.averageReactionTime),
          },
          {
            label: "Meilleure réaction",
            value: formatMs(result.bestReactionTime),
          },
        ]}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {!isRunning && !countdown.isCounting && (
        <ExerciseIntro
          slug="visual-tracking"
          title="Suivi de numéros"
          tip="Reste sur cet écran jusqu'à la fin."
          stepIndex={stepIndex}
          stepTotal={stepTotal}
        >
          <TestInstructions
            steps={[
              `${itemCount} numéros bougent sur le terrain.`,
              "Touche le numéro affiché dans « Trouve ».",
              `Le test dure ${durationMs / 1000} secondes.`,
            ]}
          />
        </ExerciseIntro>
      )}

      {(isRunning || countdown.isCounting) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
          <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand-soft px-4 py-2">
            <span className="text-sm uppercase tracking-wide text-brand">
              Trouve
            </span>
            <span className="text-4xl font-bold tabular-nums text-brand">
              {test.targetNumber ?? "—"}
            </span>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            <StatCard label="Temps" value={formatSeconds(test.remainingMs)} />
            <StatCard label="Trouvés" value={test.targetsFound} />
            <StatCard label="Erreurs" value={test.wrongClicks} />
          </div>
        </div>
      )}

      {(isRunning || countdown.isCounting) && (
        <div className="relative">
          <CountdownOverlay
            count={countdown.count}
            onCancel={sessionMode ? undefined : countdown.cancel}
            allowCancel={!sessionMode}
          />
          <TrackingArea
            numbers={test.numbers}
            targetNumber={test.targetNumber}
            running={isRunning}
            onPress={test.pressNumber}
          />
        </div>
      )}

      {!isRunning && !countdown.isCounting && (
        <Button onClick={countdown.begin}>
          {sessionMode ? "Démarrer l'exercice" : "Commencer"}
        </Button>
      )}
    </section>
  );
}
