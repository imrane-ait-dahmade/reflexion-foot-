"use client";

import { motion, useReducedMotion } from "motion/react";
import type { TestSlug } from "@/lib/db/types";

type ExerciseDemoProps = {
  slug: TestSlug;
};

/** Short looping scene that shows how the exercise works, without text walls. */
export function ExerciseDemo({ slug }: ExerciseDemoProps) {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-[16/10] w-full max-w-sm overflow-hidden rounded-2xl border border-brand/30 bg-black"
    >
      {slug === "visual-tracking" ? <TrackingDemo reduce={reduce} /> : null}
      {slug === "visual-memory" ? <MemoryDemo reduce={reduce} /> : null}
      {slug === "reaction-time" ? <ReactionDemo reduce={reduce} /> : null}
      {slug === "peripheral-vision" ? <PeripheralDemo reduce={reduce} /> : null}
      {slug === "football-visual-scanning" ? <ScanningDemo reduce={reduce} /> : null}
      {slug === "sequential-visual-search" ? <SequentialDemo reduce={reduce} /> : null}
      {slug === "digit-memory" ? <DigitDemo reduce={reduce} /> : null}
      {slug === "dual-target-tracking" ? <DualDemo reduce={reduce} /> : null}
    </div>
  );
}

function TrackingDemo({ reduce }: { reduce: boolean | null }) {
  return (
    <div className="absolute inset-0">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <motion.span
          key={index}
          className="absolute flex size-8 items-center justify-center rounded-full border border-white/20 bg-surface text-xs font-bold"
          style={{ left: `${12 + index * 12}%`, top: `${20 + (index % 3) * 22}%` }}
          animate={
            reduce
              ? undefined
              : { x: [0, 18, -12, 0], y: [0, -14, 10, 0] }
          }
          transition={{ duration: 3 + index * 0.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {index + 1}
        </motion.span>
      ))}
      <motion.span
        className="absolute size-10 rounded-full border-2 border-brand"
        animate={reduce ? { left: "42%", top: "40%" } : { left: ["18%", "58%", "34%", "18%"], top: ["28%", "48%", "22%", "28%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function MemoryDemo({ reduce }: { reduce: boolean | null }) {
  const cells = Array.from({ length: 9 }, (_, index) => index);
  const lit = new Set([1, 4, 6]);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="grid grid-cols-3 gap-2">
        {cells.map((cell) => (
          <motion.span
            key={cell}
            className="size-10 rounded-lg border border-border bg-surface"
            animate={
              reduce
                ? { backgroundColor: lit.has(cell) ? "rgb(0 128 96)" : "rgb(26 26 26)" }
                : {
                    backgroundColor: lit.has(cell)
                      ? ["rgb(26 26 26)", "rgb(0 128 96)", "rgb(0 128 96)", "rgb(26 26 26)"]
                      : "rgb(26 26 26)",
                  }
            }
            transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.2, 0.65, 1] }}
          />
        ))}
      </div>
    </div>
  );
}

function ReactionDemo({ reduce }: { reduce: boolean | null }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.span
        className="size-24 rounded-full bg-brand"
        animate={
          reduce
            ? { opacity: 1, scale: 1 }
            : { opacity: [0, 0, 1, 1, 0], scale: [0.6, 0.6, 1, 1, 0.8] }
        }
        transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.45, 0.5, 0.85, 1] }}
      />
      <motion.span
        className="absolute bottom-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted"
        animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.8, repeat: Infinity }}
      >
        Tape
      </motion.span>
    </div>
  );
}

function PeripheralDemo({ reduce }: { reduce: boolean | null }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-3xl font-bold text-brand">+</span>
      <motion.span
        className="absolute size-8 rounded-full bg-brand"
        animate={
          reduce
            ? { left: "18%", opacity: 1 }
            : {
                left: ["18%", "18%", "74%", "74%", "18%"],
                opacity: [0, 1, 1, 1, 0],
              }
        }
        transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.15, 0.5, 0.65, 1] }}
        style={{ top: "42%" }}
      />
    </div>
  );
}

function ScanningDemo({ reduce }: { reduce: boolean | null }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-4 px-6">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="flex size-14 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold"
          animate={
            reduce
              ? { borderColor: index === 1 ? "rgb(0 128 96)" : "rgb(42 42 42)", scale: index === 1 ? 1.08 : 1 }
              : {
                  borderColor:
                    index === 1
                      ? ["rgb(42 42 42)", "rgb(0 128 96)", "rgb(0 128 96)", "rgb(42 42 42)"]
                      : "rgb(42 42 42)",
                  scale: index === 1 ? [1, 1.08, 1.08, 1] : 1,
                }
          }
          transition={{ duration: 2.8, repeat: Infinity }}
        >
          {index + 1}
        </motion.span>
      ))}
    </div>
  );
}

function SequentialDemo({ reduce }: { reduce: boolean | null }) {
  const numbers = [1, 2, 3, 4, 5, 6];
  return (
    <div className="absolute inset-0">
      {numbers.map((number, index) => (
        <motion.span
          key={number}
          className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-surface text-xs font-bold"
          style={{
            left: `${20 + (index % 3) * 28}%`,
            top: `${28 + Math.floor(index / 3) * 34}%`,
          }}
          animate={
            reduce
              ? { backgroundColor: number <= 2 ? "rgb(0 128 96)" : "rgb(26 26 26)" }
              : {
                  backgroundColor: [
                    "rgb(26 26 26)",
                    number === 1 ? "rgb(0 128 96)" : "rgb(26 26 26)",
                    number <= 2 ? "rgb(0 128 96)" : "rgb(26 26 26)",
                    number <= 2 ? "rgb(0 128 96)" : "rgb(26 26 26)",
                  ],
                }
          }
          transition={{ duration: 3.4, repeat: Infinity }}
        >
          {number}
        </motion.span>
      ))}
    </div>
  );
}

function DigitDemo({ reduce }: { reduce: boolean | null }) {
  const digits = ["4", "7", "2"];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
      <div className="flex h-16 items-center justify-center">
        {digits.map((digit, index) => (
          <motion.span
            key={digit}
            className="absolute text-5xl font-bold tabular-nums text-brand"
            animate={
              reduce
                ? { opacity: index === 0 ? 1 : 0 }
                : { opacity: [0, 0, 1, 1, 0, 0] }
            }
            transition={{
              duration: 3.6,
              repeat: Infinity,
              delay: index * 0.9,
              times: [0, 0.05, 0.15, 0.55, 0.7, 1],
            }}
          >
            {digit}
          </motion.span>
        ))}
      </div>
      <div className="flex gap-2">
        {digits.map((digit) => (
          <span
            key={`pad-${digit}`}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold"
          >
            {digit}
          </span>
        ))}
      </div>
    </div>
  );
}

function DualDemo({ reduce }: { reduce: boolean | null }) {
  return (
    <div className="absolute inset-0">
      {[0, 1, 2, 3, 4, 5].map((id) => {
        const marked = id === 1 || id === 4;
        return (
          <motion.span
            key={id}
            className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold"
            style={{ left: `${18 + id * 12}%`, top: "45%" }}
            animate={
              reduce
                ? {
                    backgroundColor: marked ? "rgb(0 128 96)" : "rgb(255 255 255)",
                    color: marked ? "#fff" : "#000",
                    x: 0,
                    y: 0,
                  }
                : {
                    backgroundColor: [
                      marked ? "rgb(0 128 96)" : "rgb(255 255 255)",
                      marked ? "rgb(0 128 96)" : "rgb(255 255 255)",
                      "rgb(255 255 255)",
                      "rgb(255 255 255)",
                    ],
                    color: [
                      marked ? "#fff" : "#000",
                      marked ? "#fff" : "#000",
                      "#000",
                      "#000",
                    ],
                    x: [0, 0, (id % 2 === 0 ? 1 : -1) * 28, (id % 2 === 0 ? 1 : -1) * 12],
                    y: [0, 0, (id % 3) * 12 - 16, (id % 2) * 10 - 8],
                  }
            }
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.25, 0.7, 1] }}
          >
            {id + 1}
          </motion.span>
        );
      })}
    </div>
  );
}
