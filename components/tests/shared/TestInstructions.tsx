"use client";

import { motion } from "motion/react";

type TestInstructionsProps = {
  steps: string[];
  tip?: string;
};

export function TestInstructions({ steps, tip }: TestInstructionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <motion.li
            key={step}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * index }}
            className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-muted"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
              {index + 1}
            </span>
            <span>{step}</span>
          </motion.li>
        ))}
      </ul>
      {tip ? (
        <p className="rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-xs text-brand">
          {tip}
        </p>
      ) : null}
    </div>
  );
}
