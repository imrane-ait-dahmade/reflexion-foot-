"use client";

import { Button } from "@/components/ui/Button";
import { CountdownOverlay } from "@/components/tests/shared/CountdownOverlay";
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
};

export function VisualMemoryTest({
  sessionPlayerId,
}: VisualMemoryTestProps = {}) {
  const test = useVisualMemoryTest();
  const countdown = useCountdownStart(test.start);
  const isRunning = test.phase === "running";
  const isMemorizing = isRunning && test.roundPhase === "memorize";
  const sessionMode = Boolean(sessionPlayerId);
  const remainingToFind = isRunning && !isMemorizing
    ? Math.max(0, targetsPerRound - test.selected.length)
    : targetsPerRound;

  useLeaveGuard(isRunning || countdown.isCounting);

  if (test.phase === "finished" && test.result) {
    const { result } = test;
    return (
      <div className="flex flex-col gap-3">
        {sessionPlayerId && (
          <SaveResultEffect
            sessionPlayerId={sessionPlayerId}
            testSlug="visual-memory"
            result={result}
            metrics={{
              roundsCompleted: result.roundsCompleted,
              correctCells: result.correctCells,
            }}
          />
        )}
        <TestResults
          title="Résultat — Mémoire visuelle"
          score={`${result.score} / ${VISUAL_MEMORY_SCORING.maxScore}`}
          onRestart={test.start}
          sessionMode={sessionMode}
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
      </div>
    );
  }

  const instruction = !isRunning
    ? countdown.isCounting
      ? "Prépare-toi"
      : "Appuie sur Commencer"
    : isMemorizing
      ? "MÉMORISE"
      : `SÉLECTIONNE · ${remainingToFind} restante${remainingToFind > 1 ? "s" : ""}`;

  return (
    <section className="flex flex-col gap-4">
      {!isRunning && !countdown.isCounting && (
        <TestInstructions
          tip="Pendant « MÉMORISE », ne touche rien. Attends que les cases s'éteignent."
          steps={[
            `${targetsPerRound} cases de la grille ${gridColumns} × ${gridRows} s'allument pendant ${memorizeMs / 1000} s.`,
            "Ensuite toutes les cases se ressemblent : touche celles qui étaient allumées.",
            `Quand tu as trouvé les ${targetsPerRound} cases, une nouvelle manche commence.`,
            "Un mauvais tap compte comme erreur.",
            `Le test s'arrête après ${durationMs / 1000} secondes.`,
          ]}
        />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
        <div
          className={`flex flex-1 items-center justify-center rounded-xl border px-4 py-3 ${
            isMemorizing
              ? "border-brand/40 bg-brand-soft text-brand"
              : isRunning
                ? "border-border bg-surface"
                : "border-border"
          }`}
        >
          <span className="text-center text-lg font-bold tracking-wide sm:text-xl">
            {instruction}
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
        <CountdownOverlay count={countdown.count} onCancel={countdown.cancel} />
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

      {!isRunning && !countdown.isCounting && (
        <Button onClick={countdown.begin}>Commencer</Button>
      )}
    </section>
  );
}
