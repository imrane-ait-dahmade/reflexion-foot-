"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FootballVisualScanningTest } from "@/components/tests/FootballVisualScanningTest";
import { PeripheralVisionTest } from "@/components/tests/PeripheralVisionTest";
import { ReactionTimeTest } from "@/components/tests/ReactionTimeTest";
import { VisualMemoryTest } from "@/components/tests/VisualMemoryTest";
import { VisualTrackingTest } from "@/components/tests/VisualTrackingTest";
import type { TestSlug } from "@/lib/db/types";
import {
  getServerPlayerSession,
  loadPlayerSession,
  subscribePlayerSession,
} from "@/lib/sessions/player-session";

type SessionTestRunnerProps = {
  code: string;
  testSlug: TestSlug;
};

export function SessionTestRunner({ code, testSlug }: SessionTestRunnerProps) {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribePlayerSession,
    loadPlayerSession,
    getServerPlayerSession,
  );
  const stored =
    session &&
    session.code.toUpperCase() === code.toUpperCase() &&
    session.exercises.includes(testSlug)
      ? session
      : null;
  const [step, setStep] = useState<{ index: number; total: number } | null>(
    null,
  );
  const [blocked, setBlocked] = useState<string | null>(null);
  const [ready, setReady] = useState(!stored);
  const [loadError, setLoadError] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!stored) return;

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/players/${stored.sessionPlayerId}/progress`,
        );
        const data = await response.json();
        if (!response.ok) {
          setLoadError(data.error ?? "Impossible de charger la session.");
          return;
        }

        if (data.session?.status === "closed") {
          const exercise = data.exercises?.find(
            (item: { testSlug: string }) => item.testSlug === testSlug,
          );
          if (!exercise?.completed) {
            setBlocked(
              "La session est fermée. Tu ne peux plus commencer un nouvel exercice.",
            );
            return;
          }
        }

        const exercise = data.exercises?.find(
          (item: { testSlug: string }) => item.testSlug === testSlug,
        );
        if (exercise?.completed) {
          if (data.nextExercise) {
            router.replace(`/play/${code}/${data.nextExercise}`);
          } else {
            router.replace(`/play/${code}?done=1`);
          }
          return;
        }

        // Force order: if this is not the next exercise, redirect.
        if (data.nextExercise && data.nextExercise !== testSlug) {
          router.replace(`/play/${code}/${data.nextExercise}`);
          return;
        }

        const completedCount = data.completedCount ?? 0;
        const totalCount = data.totalCount ?? stored.exercises.length;
        setStep({ index: completedCount + 1, total: totalCount });
        setLoadError("");
      } catch {
        setLoadError("Pas de connexion. Vérifie ton réseau puis réessaie.");
      } finally {
        setReady(true);
      }
    });
  }, [code, router, stored, testSlug]);

  if (!stored) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        <p className="font-semibold">Accès réservé</p>
        <p className="text-sm text-muted">
          Tu dois entrer le code de session donné par ton entraîneur avant de
          faire un exercice.
        </p>
        <Link
          href="/join"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          Entrer le code
        </Link>
      </section>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-muted">
        <Loader2 className="size-8 animate-spin text-brand" aria-hidden />
        <p>Chargement de l&apos;exercice…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-danger/40 bg-surface p-5">
        <p className="text-danger">{loadError}</p>
        <Button onClick={() => window.location.reload()}>Réessayer</Button>
      </section>
    );
  }

  if (blocked) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <p className="text-danger">{blocked}</p>
        <Link
          href={`/play/${code}`}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          Retour
        </Link>
      </section>
    );
  }

  const common = {
    sessionPlayerId: stored.sessionPlayerId,
    stepIndex: step?.index,
    stepTotal: step?.total,
  };

  switch (testSlug) {
    case "visual-tracking":
      return <VisualTrackingTest {...common} />;
    case "visual-memory":
      return <VisualMemoryTest {...common} />;
    case "reaction-time":
      return <ReactionTimeTest {...common} />;
    case "peripheral-vision":
      return <PeripheralVisionTest {...common} />;
    case "football-visual-scanning":
      return <FootballVisualScanningTest {...common} />;
  }
}
