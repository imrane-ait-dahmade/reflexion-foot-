"use client";

import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/tests/shared/StatCard";
import { TestResults } from "@/components/tests/shared/TestResults";
import { usePeripheralVisionTest } from "@/hooks/usePeripheralVisionTest";
import { formatMs, formatPercent, formatSeconds } from "@/lib/format";
import {
  PERIPHERAL_VISION_CONFIG,
  PERIPHERAL_VISION_SCORING,
} from "@/lib/tests/peripheral-vision/config";
import type { Side } from "@/lib/tests/peripheral-vision/types";

const { durationMs, stimulusVisibleMs } = PERIPHERAL_VISION_CONFIG;

const DISCLAIMER =
  "This is a performance exercise, not a medical or eye-health assessment.";

const RESPONSE_BUTTONS: { side: Side; label: string }[] = [
  { side: "left", label: "LEFT" },
  { side: "right", label: "RIGHT" },
];

export function PeripheralVisionTest() {
  const test = usePeripheralVisionTest();
  const isRunning = test.phase === "running";

  if (test.phase === "finished" && test.result) {
    const { result } = test;
    return (
      <div className="flex flex-col gap-3">
        <TestResults
          title="Peripheral Visual Performance"
          score={`${result.score} / ${PERIPHERAL_VISION_SCORING.maxScore}`}
          onRestart={test.start}
          items={[
            { label: "Trials", value: String(result.trials) },
            { label: "Correct", value: String(result.correctAnswers) },
            { label: "Wrong", value: String(result.wrongAnswers) },
            { label: "Missed", value: String(result.missed) },
            { label: "Accuracy", value: formatPercent(result.accuracy) },
            {
              label: "Average reaction",
              value: formatMs(result.averageReactionTime),
            },
            {
              label: "Best reaction",
              value: formatMs(result.bestReactionTime),
            },
            { label: "Left accuracy", value: formatPercent(result.leftAccuracy) },
            {
              label: "Right accuracy",
              value: formatPercent(result.rightAccuracy),
            },
          ]}
        />
        <p className="text-center text-xs text-foreground/60">{DISCLAIMER}</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {!isRunning && (
        <div className="rounded-xl border border-foreground/15 p-4 text-sm leading-relaxed text-foreground/80">
          <p className="mb-2 font-semibold text-foreground">How it works</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Keep looking at the “+” in the center during the whole test.</li>
            <li>A target flashes for {stimulusVisibleMs} ms near an edge.</li>
            <li>Answer LEFT or RIGHT before it disappears.</li>
            <li>The test stops after {durationMs / 1000} seconds.</li>
          </ul>
          <p className="mt-2 text-xs text-foreground/60">{DISCLAIMER}</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Time" value={formatSeconds(test.remainingMs)} />
        <StatCard label="Correct" value={test.correctAnswers} />
        <StatCard label="Wrong" value={test.wrongAnswers} />
        <StatCard label="Missed" value={test.missed} />
      </div>

      <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-xl border border-foreground/20 bg-foreground/[0.03]">
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-bold leading-none"
        >
          +
        </span>
        {test.position && (
          <span
            data-testid="peripheral-target"
            className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground sm:size-10"
            style={{
              left: `${test.position.xPercent}%`,
              top: `${test.position.yPercent}%`,
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {RESPONSE_BUTTONS.map(({ side, label }) => (
          <Button
            key={side}
            variant="secondary"
            disabled={!isRunning}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              test.respond(side);
            }}
            onClick={(event) => {
              // detail === 0 means keyboard activation (Enter / Space).
              if (event.detail === 0) test.respond(side);
            }}
            className="min-h-16 touch-manipulation select-none text-lg"
          >
            {label}
          </Button>
        ))}
      </div>

      {!isRunning && <Button onClick={test.start}>Start</Button>}
    </section>
  );
}
