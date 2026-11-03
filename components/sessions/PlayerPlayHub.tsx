"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { motion } from "motion/react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  getServerPlayerSession,
  loadPlayerSession,
  subscribePlayerSession,
} from "@/lib/sessions/player-session";

type PlayerPlayHubProps = {
  code: string;
};

type ProgressData = {
  session: { title: string; status: string; endsAt: string | null };
  completedCount: number;
  totalCount: number;
  nextExercise: string | null;
  allDone: boolean;
};

function friendlyProgressError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("fermée") || lower.includes("expir")) {
    return "Session fermée ou expirée.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Pas de connexion. Réessaie dans un instant.";
  }
  return message || "Impossible de charger la session.";
}

function PlayerPlayHubInner({ code }: PlayerPlayHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showDone = searchParams.get("done") === "1";
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
  const [, startTransition] = useTransition();

  const loadAndRoute = useCallback(() => {
    if (!session) return;
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/players/${session.sessionPlayerId}/progress`,
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Erreur");
        setProgress(data);
        setError("");

        if (data.session?.status === "closed" && !data.allDone) {
          setError("La session est fermée. Tu ne peux plus continuer.");
          return;
        }

        if (data.allDone || showDone) {
          return;
        }

        if (data.nextExercise) {
          router.replace(`/play/${session.code}/${data.nextExercise}`);
        }
      } catch (err) {
        setError(
          friendlyProgressError(err instanceof Error ? err.message : "Erreur"),
        );
      }
    });
  }, [router, session, showDone]);

  useEffect(() => {
    loadAndRoute();
  }, [loadAndRoute]);

  if (!session) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        <p>Tu n&apos;as pas encore rejoint cette session sur cet appareil.</p>
        <Link
          href="/join"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          Entrer le code
        </Link>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-danger/40 bg-surface p-5">
        <p className="text-danger">{error}</p>
        <button
          type="button"
          onClick={loadAndRoute}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
        >
          Réessayer
        </button>
      </section>
    );
  }

  if (progress?.allDone || showDone) {
    return (
      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 rounded-2xl border border-brand/40 bg-surface px-5 py-10 text-center"
      >
        <CheckCircle2 className="size-16 text-brand" aria-hidden />
        <h2 className="text-2xl font-bold">Terminé</h2>
        <p className="max-w-sm text-muted">
          Merci {session.displayName}. Tes exercices sont envoyés à ton
          entraîneur.
        </p>
        <p className="text-xs uppercase tracking-[0.18em] text-brand">
          {progress?.completedCount ?? session.exercises.length} /{" "}
          {progress?.totalCount ?? session.exercises.length} exercices
        </p>
      </motion.section>
    );
  }

  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-5 py-10 text-center">
      <Loader2 className="size-10 animate-spin text-brand" aria-hidden />
      <p className="text-muted">Préparation de ton parcours…</p>
    </section>
  );
}

export function PlayerPlayHub({ code }: PlayerPlayHubProps) {
  return (
    <Suspense
      fallback={
        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-5 py-10 text-center">
          <Loader2 className="size-10 animate-spin text-brand" aria-hidden />
          <p className="text-muted">Chargement…</p>
        </section>
      }
    >
      <PlayerPlayHubInner code={code} />
    </Suspense>
  );
}
