"use client";

import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/tests/shared/StatCard";
import { TestResults } from "@/components/tests/shared/TestResults";
import { useReactionTimeTest } from "@/hooks/useReactionTimeTest";
import { formatMs } from "@/lib/format";
import {
  REACTION_TIME_CONFIG,
  REACTION_TIME_SCORING,
} from "@/lib/tests/reaction-time/config";

const { attempts, minDelayMs, maxDelayMs } = REACTION_TIME_CONFIG;

export function ReactionTimeTest() {
  const test = useReactionTimeTest();
  const isRunning = test.phase === "running";

  if (test.phase === "finished" && test.result) {
    const { result } = test;
    return (
      <TestResults
        title="Reaction Time Result"
        score={`${result.score} / ${REACTION_TIME_SCORING.maxScore}`}
        onRestart={test.start}
        items={[
          { label: "Attempts", value: String(result.attempts) },
          { label: "False starts", value: String(result.falseStarts) },
          { label: "Average", value: formatMs(result.averageReactionTime) },
          { label: "Best", value: formatMs(result.bestReactionTime) },
          { label: "Worst", value: formatMs(result.worstReactionTime) },
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
            <li>
              Wait while “WAIT...” is shown ({minDelayMs / 1000} to{" "}
              {maxDelayMs / 1000} s).
            </li>
            <li>Tap the circle as fast as you can when it appears.</li>
            <li>Tapping too early is a false start and restarts the attempt.</li>
            <li>The test ends after {attempts} reactions.</li>
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Attempt"
          value={isRunning ? `${test.currentAttempt} / ${test.totalAttempts}` : "—"}
        />
        <StatCard label="Last" value={formatMs(test.lastReactionTime)} />
        <StatCard label="False starts" value={test.falseStarts} />
      </div>

      <div
        onPointerDown={(event) => {
          if (event.button !== 0 || !isRunning) return;
          event.preventDefault();
          test.pressArea();
        }}
        className="flex aspect-square w-full touch-manipulation select-none items-center justify-center rounded-xl border border-foreground/20 bg-foreground/[0.03] sm:aspect-[4/3]"
      >
        {!isRunning && (
          <span className="text-foreground/60">Press Start Test</span>
        )}
        {isRunning && test.attemptPhase === "waiting" && (
          <span className="text-3xl font-bold tracking-wide">WAIT...</span>
        )}
        {isRunning && test.attemptPhase === "tooEarly" && (
          <span className="text-3xl font-bold text-red-500">Too early!</span>
        )}
        {isRunning && test.attemptPhase === "stimulus" && (
          <button
            type="button"
            aria-label="Reaction target"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              test.pressTarget();
            }}
            onClick={(event) => {
              // detail === 0 means keyboard activation (Enter / Space).
              if (event.detail === 0) test.pressTarget();
            }}
            className="size-40 rounded-full bg-emerald-500 sm:size-48"
          />
        )}
      </div>

      {!isRunning && <Button onClick={test.start}>Start Test</Button>}
    </section>
  );
}
