import { describe, expect, it } from "vitest";
import { formatMs, formatPercent, formatResponseTime, formatSeconds } from "@/lib/format";
import { randomInt, sampleUniqueInts } from "@/lib/tests/random";
import {
  buildPeripheralVisionResult,
  buildReactionTimeResult,
  buildVisualMemoryResult,
  buildVisualTrackingResult,
  calculateAccuracy,
  calculateReactionStats,
} from "@/lib/tests/scoring";
import { createRoundTargets } from "@/lib/tests/visual-memory/rounds";
import { VISUAL_MEMORY_CELL_COUNT } from "@/lib/tests/visual-memory/config";
import { pickNextTarget } from "@/lib/tests/visual-tracking/targets";
import {
  clampMovingItems,
  findPressedItem,
  stepMovingItems,
  type MovingItem,
} from "@/lib/tests/visual-tracking/motion";
import { PERIPHERAL_POSITIONS } from "@/lib/tests/peripheral-vision/positions";

describe("shared scoring", () => {
  it("calculates accuracy and reaction stats", () => {
    expect(calculateAccuracy(0, 0)).toBe(0);
    expect(calculateAccuracy(3, 1)).toBe(75);
    expect(calculateReactionStats([])).toEqual({
      averageReactionTime: 0,
      bestReactionTime: 0,
    });
    expect(calculateReactionStats([300, 500])).toEqual({
      averageReactionTime: 400,
      bestReactionTime: 300,
    });
  });

  it("scores each of the four original exercises from its own rules", () => {
    const tracking = buildVisualTrackingResult({
      reactionTimes: Array.from({ length: 20 }, () => 500),
      wrongClicks: 0,
      duration: 30000.4,
    });
    expect(tracking.score).toBe(100);
    expect(tracking.targetsFound).toBe(20);
    expect(tracking.accuracy).toBe(100);

    const memory = buildVisualMemoryResult({
      roundsCompleted: 1,
      correctCells: 50,
      wrongClicks: 0,
      responseTimes: [1000],
      duration: 20000,
    });
    expect(memory.score).toBe(100);
    expect(memory.correctCells).toBe(50);

    const reaction = buildReactionTimeResult({
      reactionTimes: [150, 150],
      falseStarts: 2,
      duration: 8000,
    });
    expect(reaction.score).toBe(90);
    expect(reaction.errors).toBe(2);
    expect(reaction.worstReactionTime).toBe(150);

    const peripheral = buildPeripheralVisionResult({
      reactionTimes: [250, 250],
      wrongAnswers: 0,
      missed: 0,
      sideStats: {
        left: { trials: 1, correct: 1 },
        right: { trials: 1, correct: 0 },
      },
      duration: 10000,
    });
    expect(peripheral.score).toBe(100);
    expect(peripheral.leftAccuracy).toBe(100);
    expect(peripheral.rightAccuracy).toBe(0);
    expect(peripheral.errors).toBe(0);
  });

  it("gives no score when nothing was answered", () => {
    expect(
      buildVisualTrackingResult({
        reactionTimes: [],
        wrongClicks: 3,
        duration: 1000,
      }).score,
    ).toBe(0);
    expect(
      buildReactionTimeResult({
        reactionTimes: [],
        falseStarts: 1,
        duration: 1000,
      }).score,
    ).toBe(0);
  });
});

describe("exercise mechanics", () => {
  it("draws distinct memory cells and tracking targets", () => {
    const cells = createRoundTargets();
    expect(new Set(cells).size).toBe(5);
    expect(cells.every((cell) => cell >= 0 && cell < VISUAL_MEMORY_CELL_COUNT)).toBe(
      true,
    );

    expect(pickNextTarget([4, 8, 15], 8, 0)).toBe(4);
    expect(pickNextTarget([8], 8, 0.9)).toBe(8);
    expect(sampleUniqueInts(3, 1, 3).sort()).toEqual([1, 2, 3]);
    expect(() => sampleUniqueInts(4, 1, 3)).toThrow();
    expect(randomInt(2, 2, 0.99)).toBe(2);
  });

  it("keeps tracking numbers inside the area and prefers the target when they overlap", () => {
    const area = { width: 200, height: 100 };
    const items: MovingItem[] = [
      { value: 7, x: 10, y: 10, vx: -500, vy: 0 },
      { value: 9, x: 10, y: 10, vx: 0, vy: 0 },
    ];
    stepMovingItems(items, 1, area);
    expect(items[0].x).toBe(0);
    expect(items[0].vx).toBeGreaterThan(0);

    expect(findPressedItem(items, 32, 32, 9)?.value).toBe(9);
    clampMovingItems([{ value: 1, x: 999, y: -20, vx: 1, vy: 1 }], area);
  });

  it("places peripheral targets away from the centre", () => {
    for (const position of PERIPHERAL_POSITIONS) {
      const distance = Math.hypot(position.xPercent - 50, position.yPercent - 50);
      expect(distance).toBeGreaterThan(30);
      expect(position.side === "left" ? position.xPercent < 50 : position.xPercent > 50).toBe(
        true,
      );
    }
  });
});

describe("result formatting", () => {
  it("formats times and percentages", () => {
    expect(formatMs(0)).toBe("—");
    expect(formatMs(241.2)).toBe("241 ms");
    expect(formatPercent(75)).toBe("75.0%");
    expect(formatSeconds(12000)).toBe("12.0 s");
    expect(formatResponseTime(1530)).toBe("1.53 s");
  });
});
