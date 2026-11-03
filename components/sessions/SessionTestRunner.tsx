"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/Button";
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
import { TESTS } from "@/lib/tests/registry";

type SessionTestRunnerProps = {
  code: string;
  testSlug: TestSlug;
};

export function SessionTestRunner({ code, testSlug }: SessionTestRunnerProps) {
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
  const [alreadyDone, setAlreadyDone] = useState<{
    score: number;
    nextExercise: TestSlug | null;
  } | null>(null);
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
          setAlreadyDone({
            score: exercise.score,
            nextExercise: data.nextExercise,
          });
        }
        setLoadError("");
      } catch {
        setLoadError(
          "Pas de connexion. Vérifie ton réseau puis réessaie.",
        );
      } finally {
        setReady(true);
      }
    });
  }, [stored, testSlug]);

  if (!stored) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        <p>Session joueur introuvable sur cet appareil.</p>
        <p className="text-sm text-muted">
          Rejoins d&apos;abord avec le code pour enregistrer tes scores.
        </p>
        <Link
          href="/join"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          Rejoindre
        </Link>
      </section>
    );
  }

  if (!ready) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-muted">
        Chargement de l&apos;exercice…
      </p>
    );
  }

  if (loadError) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-danger/40 bg-surface p-5">
        <p className="text-danger">{loadError}</p>
        <Button
          onClick={() => {
            setReady(false);
            setLoadError("");
            startTransition(async () => {
              try {
                const response = await fetch(
                  `/api/players/${stored.sessionPlayerId}/progress`,
                );
                const data = await response.json();
                if (!response.ok) {
                  setLoadError(data.error ?? "Erreur");
                  return;
                }
                const exercise = data.exercises?.find(
                  (item: { testSlug: string }) => item.testSlug === testSlug,
                );
                if (exercise?.completed) {
                  setAlreadyDone({
                    score: exercise.score,
                    nextExercise: data.nextExercise,
                  });
                }
                if (
                  data.session?.status === "closed" &&
                  !exercise?.completed
                ) {
                  setBlocked(
                    "La session est fermée. Tu ne peux plus commencer un nouvel exercice.",
                  );
                }
              } catch {
                setLoadError("Pas de connexion. Réessaie.");
              } finally {
                setReady(true);
              }
            });
          }}
        >
          Réessayer
        </Button>
        <Link
          href={`/play/${code}`}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 font-semibold"
        >
          Retour à la session
        </Link>
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
          Retour à la session
        </Link>
      </section>
    );
  }

  if (alreadyDone) {
    const nextTest = alreadyDone.nextExercise
      ? TESTS.find((test) => test.slug === alreadyDone.nextExercise)
      : null;
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <p className="text-brand">
          Cet exercice est déjà terminé ({alreadyDone.score}/100).
        </p>
        <p className="text-sm text-muted">
          En session, un seul essai compte. Passe au suivant ou retourne au
          hub.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {alreadyDone.nextExercise ? (
            <Link
              href={`/play/${code}/${alreadyDone.nextExercise}`}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
            >
              Exercice suivant
              {nextTest ? ` : ${nextTest.name}` : ""}
            </Link>
          ) : null}
          <Link
            href={`/play/${code}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-border px-6 font-semibold"
          >
            Retour à la session
          </Link>
        </div>
      </section>
    );
  }

  switch (testSlug) {
    case "visual-tracking":
      return <VisualTrackingTest sessionPlayerId={stored.sessionPlayerId} />;
    case "visual-memory":
      return <VisualMemoryTest sessionPlayerId={stored.sessionPlayerId} />;
    case "reaction-time":
      return <ReactionTimeTest sessionPlayerId={stored.sessionPlayerId} />;
    case "peripheral-vision":
      return <PeripheralVisionTest sessionPlayerId={stored.sessionPlayerId} />;
  }
}
