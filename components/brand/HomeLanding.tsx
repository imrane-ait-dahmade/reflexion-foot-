"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
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
      <div className="mx-auto aspect-video w-full max-w-xl rounded-2xl border border-border bg-surface md:aspect-auto md:h-[min(34vh,17.5rem)]" />
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

  // Tablet/PC home: one viewport, no page scroll (footer stays visible).
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      document.documentElement.classList.toggle("home-fit", media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      document.documentElement.classList.remove("home-fit");
      media.removeEventListener("change", sync);
    };
  }, []);

  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 overflow-x-hidden px-4 py-10 md:max-w-6xl md:min-h-0 md:justify-center md:gap-0 md:overflow-hidden md:py-4 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,rgb(0_128_96_/_0.18),transparent_65%)] md:h-full md:bg-[radial-gradient(ellipse_at_center,rgb(0_128_96_/_0.12),transparent_70%)]"
      />

      <div className="flex flex-col gap-10 md:grid md:min-h-0 md:flex-1 md:grid-cols-2 md:items-center md:gap-8 lg:gap-12">
        <motion.div
          className="flex flex-col items-center gap-5 text-center md:gap-4"
          {...fadeUp(reduceMotion, 0)}
        >
          <header className="flex flex-col items-center gap-3 md:gap-2.5">
            <BrandMark href={false} size="md" />
            <h1 className="text-3xl font-bold tracking-tight md:text-[1.85rem] lg:text-4xl">
              RealScouting Academy
            </h1>
            <p className="max-w-md text-lg text-foreground md:text-base lg:text-lg">
              C&apos;est mental, et ça fait travailler les muscles des yeux.
            </p>
          </header>

          <section className="w-full" aria-label="Démonstration">
            <HomeDemoVideo className="md:max-w-none" />
          </section>
        </motion.div>

        <motion.div
          className="flex flex-col gap-8 md:gap-6"
          {...fadeUp(reduceMotion, 0.12)}
        >
          <section
            className="flex flex-col gap-5 md:gap-4"
            aria-label="Idée de l'application"
          >
            <div className="text-center md:text-left">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand">
                L&apos;idée
              </p>
              <p className="mt-2 text-base text-muted md:text-sm lg:text-base">
                Une séance courte. Peu de mots. Beaucoup de regard.
              </p>
            </div>

            <div className="relative grid grid-cols-3 gap-2 sm:gap-4">
              <div
                aria-hidden
                className="pointer-events-none absolute top-[2.15rem] right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent sm:block md:top-[1.9rem]"
              />

              {IDEA_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.label}
                    className="flex flex-col items-center gap-2.5 text-center md:gap-2"
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: reduceMotion ? 0 : 0.2 + index * 0.1,
                      duration: 0.4,
                      ease: EASE,
                    }}
                  >
                    <motion.span
                      className="relative flex size-14 items-center justify-center rounded-2xl border border-brand/35 bg-brand-soft text-brand md:size-12 lg:size-14"
                      animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
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
                      <Icon
                        className="size-6 md:size-5 lg:size-6"
                        strokeWidth={1.6}
                      />
                    </motion.span>
                    <span className="text-sm font-semibold">{step.label}</span>
                    <span className="max-w-[7.5rem] text-xs leading-snug text-muted">
                      {step.hint}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 md:gap-3">
            <Link
              href="/coach"
              className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-7 text-center transition hover:border-brand hover:bg-surface-hover md:py-5 lg:py-7"
            >
              <span className="flex size-14 items-center justify-center rounded-full border border-brand/40 bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white md:size-12 lg:size-14">
                <ClipboardList
                  className="size-7 md:size-6 lg:size-7"
                  strokeWidth={1.6}
                  aria-hidden
                />
              </span>
              <span className="text-lg font-semibold md:text-base lg:text-lg">
                Entraîneur
              </span>
            </Link>

            <Link
              href="/join"
              className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-7 text-center transition hover:border-brand hover:bg-surface-hover md:py-5 lg:py-7"
            >
              <span className="flex size-14 items-center justify-center rounded-full border border-brand/40 bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white md:size-12 lg:size-14">
                <UserRound
                  className="size-7 md:size-6 lg:size-7"
                  strokeWidth={1.6}
                  aria-hidden
                />
              </span>
              <span className="text-lg font-semibold md:text-base lg:text-lg">
                Joueur
              </span>
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
