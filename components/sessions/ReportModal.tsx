"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { X } from "lucide-react";
import type { LocalizedReport } from "@/lib/ai-analysis/types";

export function ReportModal({
  open,
  onClose,
  title,
  subtitle,
  direction,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  direction: "ltr" | "rtl";
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            dir={direction}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{title}</h2>
                {subtitle ? (
                  <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ReportBody({
  content,
  labels,
  chart,
}: {
  content: LocalizedReport;
  labels: {
    assessed: string;
    observations: string;
    strengths: string;
    development: string;
    training: string;
    plan: string;
    limits: string;
  };
  chart?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-base leading-relaxed">{content.executive_summary}</p>
      {chart}
      <Block title={labels.assessed} text={content.what_was_assessed} />
      <ListBlock
        title={labels.observations}
        items={content.performance_observations.map(
          (item) => `${item.title} — ${item.explanation}`,
        )}
      />
      <ListBlock
        title={labels.strengths}
        items={content.strengths.map(
          (item) => `${item.title} — ${item.explanation}`,
        )}
      />
      <ListBlock
        title={labels.development}
        items={content.development_areas.map(
          (item) => `${item.title} — ${item.explanation}`,
        )}
      />
      <ListBlock
        title={labels.training}
        items={content.training_recommendations.map(
          (item) => `${item.title} — ${item.practical_exercise}`,
        )}
      />
      <ListBlock title={labels.plan} items={content.coach_action_plan} />
      <ListBlock title={labels.limits} items={content.limitations} />
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-muted">{text}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc ps-5 text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisWait({ label }: { label: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 rounded-xl border border-brand/40 bg-brand-soft px-3 py-3"
    >
      <span
        className="relative flex size-8 shrink-0 items-center justify-center"
        aria-hidden
      >
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="absolute size-8 rounded-full border border-brand"
            animate={
              reduce
                ? { opacity: 0.45 }
                : { scale: [0.45, 1], opacity: [0.75, 0] }
            }
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: index * 0.32,
              ease: "easeOut",
            }}
          />
        ))}
        <motion.span
          className="size-2.5 rounded-full bg-brand"
          animate={reduce ? undefined : { scale: [1, 1.3, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      </span>
      <p className="text-sm">{label}</p>
    </motion.div>
  );
}
