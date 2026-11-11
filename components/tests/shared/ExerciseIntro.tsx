"use client";

import dynamic from "next/dynamic";
import { motion } from "motion/react";
import {
  Binary,
  Crosshair,
  Eye,
  Grid3X3,
  type LucideIcon,
  Move,
  Search,
  Spline,
  Timer,
  Zap,
} from "lucide-react";
import type { TestSlug } from "@/lib/db/types";

const ExerciseDemo = dynamic(
  () =>
    import("@/components/tests/shared/ExerciseDemo").then(
      (module) => module.ExerciseDemo,
    ),
  {
    loading: () => (
      <div className="mx-auto aspect-[16/10] w-full max-w-sm rounded-2xl border border-brand/30 bg-black" />
    ),
  },
);

const VISUALS: Record<
  TestSlug,
  { Icon: LucideIcon; accent: string; hint: string }
> = {
  "visual-tracking": {
    Icon: Move,
    accent: "from-brand/30 to-transparent",
    hint: "Suit · touche · enchaîne",
  },
  "visual-memory": {
    Icon: Grid3X3,
    accent: "from-sky-500/25 to-transparent",
    hint: "Regarde · mémorise · retrouve",
  },
  "reaction-time": {
    Icon: Zap,
    accent: "from-amber-400/25 to-transparent",
    hint: "Attends · flash · tape",
  },
  "peripheral-vision": {
    Icon: Eye,
    accent: "from-violet-400/20 to-transparent",
    hint: "Fixe le + · gauche ou droite",
  },
  "football-visual-scanning": {
    Icon: Crosshair,
    accent: "from-brand/25 to-transparent",
    hint: "Lis l'action · touche le joueur",
  },
  "sequential-visual-search": {
    Icon: Search,
    accent: "from-brand/25 to-transparent",
    hint: "Cherche · 1 puis 2 · jusqu'à 50",
  },
  "digit-memory": {
    Icon: Binary,
    accent: "from-brand/25 to-transparent",
    hint: "Regarde · retiens · réécris",
  },
  "dual-target-tracking": {
    Icon: Spline,
    accent: "from-sky-500/20 to-transparent",
    hint: "Deux cibles · suis · désigne",
  },
};

type ExerciseIntroProps = {
  slug: TestSlug;
  title: string;
  tip?: string;
  stepIndex?: number;
  stepTotal?: number;
  children?: React.ReactNode;
};

export function ExerciseIntro({
  slug,
  title,
  tip,
  stepIndex,
  stepTotal,
  children,
}: ExerciseIntroProps) {
  const visual = VISUALS[slug];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div
        className={`relative flex flex-col items-center gap-4 bg-gradient-to-b ${visual?.accent ?? "from-brand/20 to-transparent"} px-4 pb-5 pt-6`}
      >
        {typeof stepIndex === "number" && typeof stepTotal === "number" ? (
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Exercice {stepIndex} / {stepTotal}
          </p>
        ) : null}

        <h2 className="text-center text-2xl font-bold">{title}</h2>
        <ExerciseDemo slug={slug} />
        <p className="flex items-center gap-2 text-sm text-brand">
          <Timer className="size-4" aria-hidden />
          {visual?.hint}
        </p>
      </div>

      {children ? <div className="border-t border-border p-4">{children}</div> : null}

      {tip ? (
        <p className="border-t border-border px-4 py-3 text-center text-xs text-muted">
          {tip}
        </p>
      ) : null}
    </motion.div>
  );
}
