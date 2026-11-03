"use client";

import { Button } from "@/components/ui/Button";
import { CountdownOverlay } from "@/components/tests/shared/CountdownOverlay";
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
};

export function VisualTrackingTest({
  sessionPlayerId,
}: VisualTrackingTestProps = {}) {
  const test = useVisualTrackingTest();
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
            testSlug="visual-tracking"
            result={result}
            metrics={{
              targetsFound: result.targetsFound,
              wrongClicks: result.errors,
            }}
          />
        )}
        <TestResults
          title="Résultat — Suivi de numéros"
          score={`${result.score} / ${VISUAL_TRACKING_SCORING.maxScore}`}
          onRestart={test.start}
          sessionMode={sessionMode}
          items={[
            { label: "Cibles trouvées", value: String(result.targetsFound) },
            { label: "Faux clics", value: String(result.errors) },
            { label: "Précision", value: formatPercent(result.accuracy) },
            {
              label: "Réaction moyenne",
              value: formatMs(result.averageReactionTime),
            },
            { label: "Meilleure réaction", value: formatMs(result.bestReactionTime) },
          ]}
        />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {!isRunning && !countdown.isCounting && (
        <TestInstructions
          tip="Reste sur cet écran jusqu'à la fin — quitter annule la tentative."
          steps={[
            `Appuie sur Commencer : ${itemCount} numéros se mettent à bouger.`,
            "Repère le numéro affiché à côté de « Trouve » et touche-le.",
            "À chaque bonne cible, un nouveau numéro apparaît.",
            "Un mauvais tap compte comme erreur et baisse ta précision.",
            `Le test s'arrête après ${durationMs / 1000} secondes.`,
          ]}
        />
      )}

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

      <div className="relative">
        <CountdownOverlay count={countdown.count} onCancel={countdown.cancel} />
        <TrackingArea
          numbers={test.numbers}
          targetNumber={test.targetNumber}
          running={isRunning}
          onPress={test.pressNumber}
        />
      </div>

      {!isRunning && !countdown.isCounting && (
        <Button onClick={countdown.begin}>Commencer</Button>
      )}
      {isRunning && (
        <p className="text-center text-xs text-muted">
          Touche uniquement le numéro demandé. Ne quitte pas l&apos;écran.
        </p>
      )}
    </section>
  );
}
