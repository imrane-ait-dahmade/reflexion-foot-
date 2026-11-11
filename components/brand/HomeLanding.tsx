"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ClipboardList,
  Eye,
  KeyRound,
  LineChart,
  UserRound,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { BrandMark } from "@/components/brand/BrandMark";

const HomeDemoVideo = dynamic(
  () =>
    import("@/components/brand/HomeDemoVideo").then(
      (module) => module.HomeDemoVideo,
    ),
  {
    loading: () => (
      <div className="mx-auto aspect-video w-full max-w-xl rounded-2xl border border-border bg-surface" />
    ),
    ssr: false,
  },
);

const IDEA_STEPS = [
  {
    icon: KeyRound,
    label: "Code",
    hint: "Le joueur entre",
  },
  {
    icon: Eye,
    label: "Regard",
    hint: "Il observe et décide",
  },
  {
    icon: LineChart,
    label: "Lecture",
    hint: "Le coach comprend",
  },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = (reduce: boolean | null, delay = 0) =>
  reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, delay, ease: EASE },
      };

export function HomeLanding() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-12 overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,rgb(0_128_96_/_0.18),transparent_65%)]"
      />

      <motion.header
        className="flex flex-col items-center gap-4 text-center"
        {...fadeUp(reduceMotion, 0)}
      >
        <BrandMark href={false} size="md" />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          RealScouting Academy
        </h1>
        <p className="max-w-md text-lg text-foreground">
          C&apos;est mental, et ça fait travailler les muscles des yeux.
        </p>
      </motion.header>

      <motion.section
        className="flex flex-col gap-3"
        aria-label="Démonstration"
        {...fadeUp(reduceMotion, 0.08)}
      >
        <HomeDemoVideo />
      </motion.section>

      <motion.section
        className="flex flex-col gap-5"
        aria-label="Idée de l'application"
        {...fadeUp(reduceMotion, 0.16)}
      >
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand">
            L&apos;idée
          </p>
          <p className="mt-2 text-base text-muted">
            Une séance courte. Peu de mots. Beaucoup de regard.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-2 sm:gap-4">
          <div
            aria-hidden
            className="pointer-events-none absolute top-[2.15rem] right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent sm:block"
          />

          {IDEA_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.label}
                className="flex flex-col items-center gap-3 text-center"
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: reduceMotion ? 0 : 0.22 + index * 0.1,
                  duration: 0.4,
                  ease: EASE,
                }}
              >
                <motion.span
                  className="relative flex size-14 items-center justify-center rounded-2xl border border-brand/35 bg-brand-soft text-brand sm:size-16"
                  animate={
                    reduceMotion
                      ? undefined
                      : { y: [0, -4, 0] }
                  }
                  transition={
                    reduceMotion
                      ? undefined
                      : {
                          duration: 2.6,
                          repeat: Infinity,
                          delay: index * 0.35,
                          ease: "easeInOut",
                        }
                  }
                >
                  <Icon className="size-6 sm:size-7" strokeWidth={1.6} />
                </motion.span>
                <span className="text-sm font-semibold">{step.label}</span>
                <span className="max-w-[7.5rem] text-xs leading-snug text-muted">
                  {step.hint}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      <motion.div
        className="grid gap-4 sm:grid-cols-2"
        {...fadeUp(reduceMotion, 0.28)}
      >
        <Link
          href="/coach"
          className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-8 text-center transition hover:border-brand hover:bg-surface-hover"
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-brand/40 bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
            <ClipboardList className="size-8" strokeWidth={1.6} aria-hidden />
          </span>
          <span className="text-lg font-semibold">Entraîneur</span>
        </Link>

        <Link
          href="/join"
          className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-8 text-center transition hover:border-brand hover:bg-surface-hover"
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-brand/40 bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
            <UserRound className="size-8" strokeWidth={1.6} aria-hidden />
          </span>
          <span className="text-lg font-semibold">Joueur</span>
        </Link>
      </motion.div>
    </main>
  );
}
