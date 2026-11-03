"use client";

import { Button } from "@/components/ui/Button";
import { CountdownOverlay } from "@/components/tests/shared/CountdownOverlay";
import { ExerciseIntro } from "@/components/tests/shared/ExerciseIntro";
import { StatCard } from "@/components/tests/shared/StatCard";
import { TestInstructions } from "@/components/tests/shared/TestInstructions";
import { TestResults } from "@/components/tests/shared/TestResults";
import { MemoryGrid } from "@/components/tests/visual-memory/MemoryGrid";
import { useCountdownStart } from "@/hooks/useCountdownStart";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useVisualMemoryTest } from "@/hooks/useVisualMemoryTest";
import {
  formatPercent,
  formatResponseTime,
  formatSeconds,
} from "@/lib/format";
import { SaveResultEffect } from "@/components/sessions/SaveResultEffect";
import {
  VISUAL_MEMORY_CELL_COUNT,
  VISUAL_MEMORY_CONFIG,
  VISUAL_MEMORY_SCORING,
} from "@/lib/tests/visual-memory/config";

const { gridColumns, gridRows, targetsPerRound, memorizeMs, durationMs } =
  VISUAL_MEMORY_CONFIG;

const NO_CELLS: number[] = [];

type VisualMemoryTestProps = {
  sessionPlayerId?: string;
  stepIndex?: number;
  stepTotal?: number;
};

export function VisualMemoryTest({
  sessionPlayerId,
  stepIndex,
  stepTotal,
}: VisualMemoryTestProps = {}) {
  const test = useVisualMemoryTest();
  const countdown = useCountdownStart(test.start);
  const isRunning = test.phase === "running";
  const isMemorizing = isRunning && test.roundPhase === "memorize";
  const sessionMode = Boolean(sessionPlayerId);
  const remainingToFind =
    isRunning && !isMemorizing
      ? Math.max(0, targetsPerRound - test.selected.length)
      : targetsPerRound;

  useLeaveGuard(isRunning || countdown.isCounting);

  if (test.phase === "finished" && test.result) {
    if (sessionMode && sessionPlayerId) {
      return (
        <SaveResultEffect
          sessionPlayerId={sessionPlayerId}
          testSlug="visual-memory"
          result={test.result}
          metrics={{
            roundsCompleted: test.result.roundsCompleted,
            correctCells: test.result.correctCells,
          }}
        />
      );
    }

    const { result } = test;
    return (
      <TestResults
        title="Résultat — Mémoire visuelle"
        score={`${result.score} / ${VISUAL_MEMORY_SCORING.maxScore}`}
        onRestart={test.start}
        items={[
          { label: "Manches", value: String(result.roundsCompleted) },
          { label: "Bonnes cases", value: String(result.correctCells) },
          { label: "Faux clics", value: String(result.errors) },
          { label: "Précision", value: formatPercent(result.accuracy) },
          {
            label: "Réponse moyenne",
            value: formatResponseTime(result.averageReactionTime),
          },
          {
            label: "Meilleure réponse",
            value: formatResponseTime(result.bestReactionTime),
          },
        ]}
      />
    );
  }

  const instruction = isMemorizing
    ? "MÉMORISE"
    : `SÉLECTIONNE · ${remainingToFind} restante${remainingToFind > 1 ? "s" : ""}`;

  return (
    <section className="flex flex-col gap-4">
      {!isRunning && !countdown.isCounting && (
        <ExerciseIntro
          slug="visual-memory"
          title="Mémoire visuelle"
          tip="Pendant MÉMORISE, ne touche rien."
          stepIndex={stepIndex}
          stepTotal={stepTotal}
        >
          <TestInstructions
            steps={[
              `${targetsPerRound} cases s'allument ${memorizeMs / 1000} s sur ${gridColumns}×${gridRows}.`,
              "Retrouve ensuite les cases allumées.",
              `Durée : ${durationMs / 1000} secondes.`,
            ]}
          />
        </ExerciseIntro>
      )}

      {(isRunning || countdown.isCounting) && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
            <div
              className={`flex flex-1 items-center justify-center rounded-xl border px-4 py-3 ${
                isMemorizing
                  ? "border-brand/40 bg-brand-soft text-brand"
                  : "border-border bg-surface"
              }`}
            >
              <span className="text-center text-lg font-bold tracking-wide sm:text-xl">
                {countdown.isCounting ? "Prépare-toi" : instruction}
              </span>
            </div>
            <div className="grid flex-1 grid-cols-4 gap-2">
              <StatCard label="Temps" value={formatSeconds(test.remainingMs)} />
              <StatCard label="Manches" value={test.roundsCompleted} />
              <StatCard label="Bonnes" value={test.correctCells} />
              <StatCard label="Erreurs" value={test.wrongClicks} />
            </div>
          </div>

          <div className="relative">
            <CountdownOverlay
              count={countdown.count}
              onCancel={sessionMode ? undefined : countdown.cancel}
              allowCancel={!sessionMode}
            />
            <MemoryGrid
              cellCount={VISUAL_MEMORY_CELL_COUNT}
              columns={gridColumns}
              highlighted={isMemorizing ? test.targets : NO_CELLS}
              selected={isRunning ? test.selected : NO_CELLS}
              disabled={!isRunning || isMemorizing || countdown.isCounting}
              wrongFlash={test.wrongFlash}
              onCellPress={test.pressCell}
            />
          </div>
        </>
      )}

      {!isRunning && !countdown.isCounting && (
        <Button onClick={countdown.begin}>
          {sessionMode ? "Démarrer l'exercice" : "Commencer"}
        </Button>
      )}
    </section>
  );
}
