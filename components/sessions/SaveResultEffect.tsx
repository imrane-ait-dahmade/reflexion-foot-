"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TestSlug } from "@/lib/db/types";
import { loadPlayerSession } from "@/lib/sessions/player-session";
import { submitClientResult } from "@/lib/sessions/submit-client";

type SaveResultEffectProps = {
  sessionPlayerId: string;
  testSlug: TestSlug;
  result: {
    score: number;
    accuracy: number;
    correctAnswers: number;
    errors: number;
    averageReactionTime: number;
    bestReactionTime: number;
    duration: number;
  } | null;
  metrics?: Record<string, unknown>;
};

type ProgressNav = {
  code: string;
  nextExercise: TestSlug | null;
  allDone: boolean;
  completedCount: number;
  totalCount: number;
};

function friendlySaveError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("fermée") || lower.includes("expir")) {
    return "La session est fermée ou a expiré. Réessaie l'envoi.";
  }
  if (lower.includes("déjà")) {
    return "Déjà enregistré.";
  }
  if (
    lower.includes("réseau") ||
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("failed to fetch")
  ) {
    return "Pas de connexion. Vérifie ton réseau puis réessaie.";
  }
  return message || "Échec de l'enregistrement.";
}

export function SaveResultEffect({
  sessionPlayerId,
  testSlug,
  result,
  metrics,
}: SaveResultEffectProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [nav, setNav] = useState<ProgressNav | null>(null);
  const attemptKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const redirected = useRef(false);

  const resolveNav = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/players/${sessionPlayerId}/progress`,
      );
      const progress = await response.json();
      if (response.ok) {
        setNav({
          code: progress.session.code,
          nextExercise: progress.nextExercise,
          allDone: progress.allDone,
          completedCount: progress.completedCount,
          totalCount: progress.totalCount,
        });
        return;
      }
    } catch {
      // Fall back below.
    }

    const stored = loadPlayerSession();
    if (!stored) return;
    const remaining = stored.exercises.filter((slug) => slug !== testSlug);
    setNav({
      code: stored.code,
      nextExercise: remaining[0] ?? null,
      allDone: remaining.length === 0,
      completedCount: stored.exercises.length - remaining.length,
      totalCount: stored.exercises.length,
    });
  }, [sessionPlayerId, testSlug]);

  const save = useCallback(async () => {
    if (!result || inFlight.current) return;
    inFlight.current = true;
    setStatus("saving");
    setMessage("");

    try {
      await submitClientResult({
        sessionPlayerId,
        testSlug,
        score: result.score,
        accuracy: result.accuracy,
        correctAnswers: result.correctAnswers,
        errors: result.errors,
        averageReactionMs: result.averageReactionTime,
        bestReactionMs: result.bestReactionTime,
        durationMs: result.duration,
        metrics,
      });
      setStatus("saved");
      setMessage("Enregistré. Passage à la suite…");
      await resolveNav();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Erreur";
      if (raw.toLowerCase().includes("déjà")) {
        setStatus("saved");
        setMessage("Déjà enregistré. Passage à la suite…");
        await resolveNav();
        return;
      }
      setStatus("error");
      setMessage(friendlySaveError(raw));
    } finally {
      inFlight.current = false;
    }
  }, [metrics, resolveNav, result, sessionPlayerId, testSlug]);

  useEffect(() => {
    if (!result) return;
    const key = `${sessionPlayerId}:${testSlug}:${result.score}:${result.duration}`;
    if (attemptKey.current === key) return;
    attemptKey.current = key;
    void save();
  }, [result, save, sessionPlayerId, testSlug]);

  // Auto-advance — player never picks the next exercise.
  useEffect(() => {
    if (status !== "saved" || !nav || redirected.current) return;
    redirected.current = true;
    const timer = window.setTimeout(() => {
      if (nav.allDone || !nav.nextExercise) {
        router.replace(`/play/${nav.code}?done=1`);
      } else {
        router.replace(`/play/${nav.code}/${nav.nextExercise}`);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [nav, router, status]);

  if (status === "idle") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-8 text-center"
    >
      {status === "saving" ? (
        <Loader2 className="size-12 animate-spin text-brand" aria-hidden />
      ) : status === "saved" ? (
        <CheckCircle2 className="size-12 text-brand" aria-hidden />
      ) : null}

      <p
        className={`text-sm ${
          status === "error" ? "text-danger" : "text-muted"
        }`}
      >
        {status === "saving" ? "Envoi en cours…" : message}
      </p>

      {status === "saved" && nav ? (
        <p className="text-xs uppercase tracking-[0.18em] text-brand">
          {nav.allDone
            ? "Session terminée"
            : `Exercice ${nav.completedCount} / ${nav.totalCount}`}
        </p>
      ) : null}

      {status === "error" ? (
        <Button
          onClick={() => {
            attemptKey.current = null;
            redirected.current = false;
            void save();
          }}
        >
          Réessayer
        </Button>
      ) : null}
    </motion.div>
  );
}
