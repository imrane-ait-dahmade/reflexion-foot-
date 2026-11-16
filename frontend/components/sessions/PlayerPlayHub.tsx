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
import {
  fetchPlayerProgressV2,
  playerApiErrorMessage,
  type PlayerProgressView,
} from "@/lib/sessions/player-v2";

type PlayerPlayHubProps = {
  code: string;
};

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
  const [progress, setProgress] = useState<PlayerProgressView | null>(null);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const loadAndRoute = useCallback(() => {
    if (!session) return;
    startTransition(async () => {
      try {
        const data = await fetchPlayerProgressV2(session.code);
        setProgress(data);
        setError("");

        if (data.session.status === "completed" || data.session.status === "cancelled") {
          if (!data.allDone) {
            setError("La session est fermée. Tu ne peux plus continuer.");
            return;
          }
        }

        if (data.allDone || showDone) {
          return;
        }

        if (data.nextExercise) {
          router.replace(`/play/${session.code}/${data.nextExercise}`);
        }
      } catch (err) {
        setError(
          playerApiErrorMessage(err, "Impossible de charger la session."),
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
          Entrer les codes
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
          Merci. Tes exercices sont envoyés à ton entraîneur.
        </p>
        <p className="text-xs tracking-[0.18em] text-brand uppercase">
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
