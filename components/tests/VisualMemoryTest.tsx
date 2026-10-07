"use client";

import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/tests/shared/StatCard";
import { TestResults } from "@/components/tests/shared/TestResults";
import { MemoryGrid } from "@/components/tests/visual-memory/MemoryGrid";
import { useVisualMemoryTest } from "@/hooks/useVisualMemoryTest";
import {
  formatPercent,
  formatResponseTime,
  formatSeconds,
} from "@/lib/format";
import {
  VISUAL_MEMORY_CELL_COUNT,
  VISUAL_MEMORY_CONFIG,
  VISUAL_MEMORY_SCORING,
} from "@/lib/tests/visual-memory/config";

const { gridColumns, gridRows, targetsPerRound, memorizeMs, durationMs } =
  VISUAL_MEMORY_CONFIG;

const NO_CELLS: number[] = [];

export function VisualMemoryTest() {
  const test = useVisualMemoryTest();
  const isRunning = test.phase === "running";
  const isMemorizing = isRunning && test.roundPhase === "memorize";

  if (test.phase === "finished" && test.result) {
    const { result } = test;
    return (
      <TestResults
        title="Visual Memory Result"
        score={`${result.score} / ${VISUAL_MEMORY_SCORING.maxScore}`}
        onRestart={test.start}
        items={[
          { label: "Rounds completed", value: String(result.roundsCompleted) },
          { label: "Correct cells", value: String(result.correctCells) },
          { label: "Wrong clicks", value: String(result.errors) },
          { label: "Accuracy", value: formatPercent(result.accuracy) },
          {
            label: "Average response",
            value: formatResponseTime(result.averageReactionTime),
          },
          {
            label: "Best response",
            value: formatResponseTime(result.bestReactionTime),
          },
        ]}
      />
    );
  }

  const instruction = !isRunning
    ? "Press Start"
    : isMemorizing
      ? "MEMORIZE"
      : "SELECT THE POSITIONS";

  return (
    <section className="flex flex-col gap-4">
      {!isRunning && (
        <div className="rounded-xl border border-foreground/15 p-4 text-sm leading-relaxed text-foreground/80">
          <p className="mb-2 font-semibold text-foreground">How it works</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {targetsPerRound} cells of the {gridColumns} × {gridRows} grid
              light up for {memorizeMs / 1000} s.
            </li>
            <li>Then all cells look the same: tap the cells that were lit.</li>
            <li>Once all {targetsPerRound} are found, a new round starts.</li>
            <li>Wrong taps count as errors and lower your accuracy.</li>
            <li>The test stops after {durationMs / 1000} seconds.</li>
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
        <div className="flex flex-1 items-center justify-center rounded-xl border border-foreground/15 px-4 py-3">
          <span className="text-lg font-bold tracking-wide sm:text-xl">
            {instruction}
          </span>
        </div>
        <div className="grid flex-1 grid-cols-4 gap-2">
          <StatCard label="Time" value={formatSeconds(test.remainingMs)} />
          <StatCard label="Rounds" value={test.roundsCompleted} />
          <StatCard label="Correct" value={test.correctCells} />
          <StatCard label="Wrong" value={test.wrongClicks} />
        </div>
      </div>

      <MemoryGrid
        cellCount={VISUAL_MEMORY_CELL_COUNT}
        columns={gridColumns}
        highlighted={isMemorizing ? test.targets : NO_CELLS}
        selected={isRunning ? test.selected : NO_CELLS}
        disabled={!isRunning || isMemorizing}
        wrongFlash={test.wrongFlash}
        onCellPress={test.pressCell}
      />

      {!isRunning && <Button onClick={test.start}>Start</Button>}
    </section>
  );
}
