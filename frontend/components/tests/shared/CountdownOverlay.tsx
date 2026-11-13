"use client";

import { AnimatePresence, motion } from "motion/react";

type CountdownOverlayProps = {
  count: number | null;
  /** In forced session flow, cancel is disabled. */
  onCancel?: () => void;
  allowCancel?: boolean;
};

export function CountdownOverlay({
  count,
  onCancel,
  allowCancel = true,
}: CountdownOverlayProps) {
  return (
    <AnimatePresence>
      {count !== null ? (
        <motion.div
          key="countdown"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/85 backdrop-blur-sm"
        >
          <p className="text-sm uppercase tracking-widest text-muted">
            Prépare-toi
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={count}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="text-7xl font-bold tabular-nums text-brand"
            >
              {count === 0 ? "GO" : count}
            </motion.p>
          </AnimatePresence>
          {allowCancel && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Annuler
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
