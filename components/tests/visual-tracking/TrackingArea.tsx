"use client";

import { memo, useEffect, useLayoutEffect, useRef } from "react";
import { VISUAL_TRACKING_CONFIG } from "@/lib/tests/visual-tracking/config";
import {
  clampMovingItems,
  createMovingItems,
  findPressedItem,
  stepMovingItems,
  type AreaSize,
  type MovingItem,
} from "@/lib/tests/visual-tracking/motion";

const { itemSize, maxFrameDeltaMs } = VISUAL_TRACKING_CONFIG;

const WRONG_CLICK_KEYFRAMES: Keyframe[] = [
  { backgroundColor: "rgb(239 68 68 / 0.7)" },
  { backgroundColor: "var(--background)" },
];
const WRONG_CLICK_DURATION_MS = 350;

type TrackingAreaProps = {
  /** A new array starts a new run: positions and velocities are re-generated. */
  numbers: number[];
  targetNumber: number | null;
  running: boolean;
  onPress: (value: number) => void;
};

function applyPositions(
  items: MovingItem[],
  elements: (HTMLSpanElement | null)[],
) {
  items.forEach((item, index) => {
    const element = elements[index];
    if (element) {
      element.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
    }
  });
}

/**
 * Positions live in refs and are written straight to the DOM on every
 * animation frame, so React never re-renders during the animation.
 */
export const TrackingArea = memo(function TrackingArea({
  numbers,
  targetNumber,
  running,
  onPress,
}: TrackingAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const itemsRef = useRef<MovingItem[]>([]);
  const areaRef = useRef<AreaSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    areaRef.current = {
      width: container.clientWidth,
      height: container.clientHeight,
    };
    itemsRef.current = createMovingItems(numbers, areaRef.current);
    applyPositions(itemsRef.current, elementsRef.current);
  }, [numbers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      areaRef.current = {
        width: container.clientWidth,
        height: container.clientHeight,
      };
      clampMovingItems(itemsRef.current, areaRef.current);
      applyPositions(itemsRef.current, elementsRef.current);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    let frameId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const deltaMs = Math.min(Math.max(now - lastTime, 0), maxFrameDeltaMs);
      lastTime = now;
      stepMovingItems(itemsRef.current, deltaMs / 1000, areaRef.current);
      applyPositions(itemsRef.current, elementsRef.current);
      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [running, numbers]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!running || event.button !== 0) return;
    event.preventDefault();

    // Rect includes the border; positions are relative to the padding box.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - event.currentTarget.clientLeft;
    const y = event.clientY - rect.top - event.currentTarget.clientTop;
    const pressed = findPressedItem(itemsRef.current, x, y, targetNumber);
    if (!pressed) return;

    onPress(pressed.value);
    if (pressed.value !== targetNumber) {
      elementsRef.current[itemsRef.current.indexOf(pressed)]?.animate(
        WRONG_CLICK_KEYFRAMES,
        { duration: WRONG_CLICK_DURATION_MS },
      );
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className="relative aspect-[3/4] w-full touch-manipulation select-none overflow-hidden rounded-xl border border-foreground/20 bg-foreground/[0.03] sm:aspect-[4/3]"
    >
      {numbers.map((value, index) => (
        <span
          key={value}
          ref={(element) => {
            elementsRef.current[index] = element;
          }}
          style={{ width: itemSize, height: itemSize }}
          className={`pointer-events-none absolute left-0 top-0 flex items-center justify-center rounded-full border border-foreground/30 bg-background text-lg font-semibold tabular-nums will-change-transform ${
            running ? "" : "opacity-50"
          }`}
        >
          {value}
        </span>
      ))}
    </div>
  );
});
