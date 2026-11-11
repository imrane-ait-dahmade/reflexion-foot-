"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ChartBar } from "@/lib/ai-analysis/report-charts";
import { clampChartValue } from "@/lib/ai-analysis/report-charts";

export function ReportBarChart({
  title,
  bars,
  max = 100,
}: {
  title: string;
  bars: ChartBar[];
  max?: number;
}) {
  const reduce = useReducedMotion();
  if (bars.length === 0) return null;
  const ceiling = Math.max(max, ...bars.map((bar) => bar.value), 1);

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <ul className="flex flex-col gap-2.5">
        {bars.map((bar, index) => {
          const width = (clampChartValue(bar.value, ceiling) / ceiling) * 100;
          return (
            <li key={`${bar.label}-${index}`} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 sm:grid-cols-[9rem_1fr_auto]">
              <span className="truncate text-xs text-muted" title={bar.label}>
                {bar.label}
              </span>
              <span className="h-2.5 overflow-hidden rounded-full bg-border">
                <motion.span
                  className="block h-full rounded-full bg-brand"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.55, delay: index * 0.05, ease: "easeOut" }}
                />
              </span>
              <span className="min-w-10 text-right text-xs font-semibold tabular-nums">
                {Math.round(bar.value)}
                {bar.detail ? (
                  <span className="font-normal text-muted"> {bar.detail}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
