"use client";

import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/tests/shared/StatCard";
import { TestResults } from "@/components/tests/shared/TestResults";
import { TrackingArea } from "@/components/tests/visual-tracking/TrackingArea";
import { useVisualTrackingTest } from "@/hooks/useVisualTrackingTest";
import { formatMs, formatPercent, formatSeconds } from "@/lib/format";
import {
  VISUAL_TRACKING_CONFIG,
  VISUAL_TRACKING_SCORING,
} from "@/lib/tests/visual-tracking/config";

const { itemCount, durationMs } = VISUAL_TRACKING_CONFIG;

export function VisualTrackingTest() {
  const test = useVisualTrackingTest();
  const isRunning = test.phase === "running";

  if (test.phase === "finished" && test.result) {
    const { result } = test;
    return (
      <TestResults
        title="Visual Tracking Result"
        score={`${result.score} / ${VISUAL_TRACKING_SCORING.maxScore}`}
        onRestart={test.start}
        items={[
          { label: "Targets found", value: String(result.targetsFound) },
          { label: "Wrong clicks", value: String(result.errors) },
          { label: "Accuracy", value: formatPercent(result.accuracy) },
          {
            label: "Average reaction",
            value: formatMs(result.averageReactionTime),
          },
          { label: "Best reaction", value: formatMs(result.bestReactionTime) },
        ]}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {!isRunning && (
        <div className="rounded-xl border border-foreground/15 p-4 text-sm leading-relaxed text-foreground/80">
          <p className="mb-2 font-semibold text-foreground">How it works</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Press Start: {itemCount} numbers start moving in the field.</li>
            <li>Track the number shown next to “Find” and tap it.</li>
            <li>Each time you find it, a new number to find is shown.</li>
            <li>Wrong taps count as errors and lower your accuracy.</li>
            <li>The test stops after {durationMs / 1000} seconds.</li>
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
        <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-foreground/15 px-4 py-2">
          <span className="text-sm uppercase tracking-wide text-foreground/70">
            Find
          </span>
          <span className="text-4xl font-bold tabular-nums">
            {test.targetNumber ?? "—"}
          </span>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-2">
          <StatCard label="Time" value={formatSeconds(test.remainingMs)} />
          <StatCard label="Found" value={test.targetsFound} />
          <StatCard label="Wrong" value={test.wrongClicks} />
        </div>
      </div>

      <TrackingArea
        numbers={test.numbers}
        targetNumber={test.targetNumber}
        running={isRunning}
        onPress={test.pressNumber}
      />

      {!isRunning && <Button onClick={test.start}>Start</Button>}
    </section>
  );
}
