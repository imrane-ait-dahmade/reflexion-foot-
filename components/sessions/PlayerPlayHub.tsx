"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Button } from "@/components/ui/Button";
import type { TestSlug } from "@/lib/db/types";
import {
  clearPlayerSession,
  getServerPlayerSession,
  loadPlayerSession,
  subscribePlayerSession,
} from "@/lib/sessions/player-session";
import { TESTS } from "@/lib/tests/registry";

type PlayerPlayHubProps = {
  code: string;
};

type ExerciseProgress = {
  testSlug: TestSlug;
  completed: boolean;
  score: number | null;
};

type ProgressData = {
  session: { title: string; status: string; endsAt: string | null };
  exercises: ExerciseProgress[];
  completedCount: number;
  totalCount: number;
  nextExercise: TestSlug | null;
  allDone: boolean;
};

function formatEndsAt(endsAt: string | null) {
  if (!endsAt) return null;
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function friendlyProgressError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("fermée") || lower.includes("expir")) {
    return "Session fermée ou expirée. Tu peux encore voir tes scores déjà envoyés.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Pas de connexion. Appuie sur Rafraîchir quand le réseau revient.";
  }
  return message || "Impossible de charger la progression.";
}

export function PlayerPlayHub({ code }: PlayerPlayHubProps) {
  const router = useRouter();
  const stored = useSyncExternalStore(
    subscribePlayerSession,
    loadPlayerSession,
    getServerPlayerSession,
  );
  const session =
    stored && stored.code.toUpperCase() === code.toUpperCase()
      ? stored
      : null;
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(session));
  const [, startTransition] = useTransition();

  const loadProgress = useCallback(() => {
    if (!session) return;
    startTransition(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/players/${session.sessionPlayerId}/progress`,
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Erreur");
        setProgress(data);
        setError("");
      } catch (err) {
        setError(
          friendlyProgressError(err instanceof Error ? err.message : "Erreur"),
        );
      } finally {
        setLoading(false);
      }
    });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    loadProgress();
  }, [loadProgress, session]);

  if (!session) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        <p>Tu n&apos;as pas encore rejoint cette session sur cet appareil.</p>
        <p className="text-sm text-muted">
          Si tu as déjà commencé sur un autre téléphone, rejoins à nouveau avec
          le même code et le même nom.
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

  const exercises =
    progress?.exercises ??
    session.exercises.map((testSlug) => ({
      testSlug,
      completed: false,
      score: null,
    }));
  const completedCount = progress?.completedCount ?? 0;
  const totalCount = progress?.totalCount ?? session.exercises.length;
  const endsLabel = formatEndsAt(progress?.session.endsAt ?? null);
  const sessionClosed = progress?.session.status === "closed";
  const canStartNew = !sessionClosed;

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">Joueur</p>
        <p className="text-xl font-semibold">{session.displayName}</p>
        <p className="text-sm text-muted">
          Code <span className="font-semibold text-brand">{session.code}</span>
          {progress?.session.title ? ` · ${progress.session.title}` : ""}
        </p>
        <p className="mt-2 text-sm text-brand">
          Progression {completedCount}/{totalCount}
          {loading && !progress ? " · chargement…" : ""}
        </p>
        {endsLabel && !sessionClosed && (
          <p className="text-xs text-muted">
            Code valide jusqu&apos;à {endsLabel}
          </p>
        )}
        {sessionClosed && (
          <p className="mt-1 text-sm text-danger">
            Session fermée — tu peux encore voir tes résultats déjà envoyés.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {progress?.allDone && (
        <p className="rounded-xl border border-brand/40 bg-brand-soft px-4 py-3 text-sm text-brand">
          Tous les exercices sont terminés. Ton entraîneur voit tes scores.
        </p>
      )}

      {progress?.nextExercise && !progress.allDone && canStartNew && (
        <Link
          href={`/play/${session.code}/${progress.nextExercise}`}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          Continuer :{" "}
          {TESTS.find((test) => test.slug === progress.nextExercise)?.name ??
            progress.nextExercise}
        </Link>
      )}

      <ul className="flex flex-col gap-3">
        {exercises.map((exercise) => {
          const test = TESTS.find((item) => item.slug === exercise.testSlug);
          const href = `/play/${session.code}/${exercise.testSlug}`;

          if (exercise.completed) {
            return (
              <li
                key={exercise.testSlug}
                className="rounded-xl border border-brand/30 bg-brand-soft p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {test?.name ?? exercise.testSlug}
                    </p>
                    <p className="text-sm text-muted">Terminé</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-brand">
                    {exercise.score}/100
                  </p>
                </div>
              </li>
            );
          }

          if (!canStartNew) {
            return (
              <li
                key={exercise.testSlug}
                className="rounded-xl border border-border bg-surface p-4 opacity-60"
              >
                <p className="font-semibold">
                  {test?.name ?? exercise.testSlug}
                </p>
                <p className="text-sm text-muted">Non terminé — session fermée</p>
              </li>
            );
          }

          return (
            <li key={exercise.testSlug}>
              <Link
                href={href}
                className="block rounded-xl border border-border bg-surface p-4 transition hover:border-brand hover:bg-surface-hover"
              >
                <p className="font-semibold">
                  {test?.name ?? exercise.testSlug}
                </p>
                <p className="text-sm text-muted">{test?.description}</p>
                <p className="mt-2 text-sm text-brand">À faire →</p>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          onClick={loadProgress}
          className="flex-1"
        >
          Rafraîchir
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            if (
              !window.confirm(
                "Quitter efface ta session sur cet appareil. Tu pourras rejoindre à nouveau avec le code.",
              )
            ) {
              return;
            }
            clearPlayerSession();
            router.push("/join");
          }}
        >
          Quitter la session
        </Button>
      </div>
    </section>
  );
}
