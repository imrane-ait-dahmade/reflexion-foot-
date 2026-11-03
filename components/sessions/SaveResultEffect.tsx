"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { TestSlug } from "@/lib/db/types";
import { loadPlayerSession } from "@/lib/sessions/player-session";
import { submitClientResult } from "@/lib/sessions/submit-client";
import { TESTS } from "@/lib/tests/registry";

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
};

function friendlySaveError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("fermée") || lower.includes("expir")) {
    return "La session est fermée ou a expiré. Réessaie l'envoi — ton score peut encore être accepté.";
  }
  if (lower.includes("déjà")) {
    return "Ce résultat est déjà enregistré.";
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
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [nav, setNav] = useState<ProgressNav | null>(null);
  const attemptKey = useRef<string | null>(null);
  const inFlight = useRef(false);

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
      setMessage("Résultat envoyé à l'entraîneur.");
      await resolveNav();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Erreur";
      if (raw.toLowerCase().includes("déjà")) {
        setStatus("saved");
        setMessage("Résultat déjà enregistré.");
        await resolveNav();
        return;
      }
      setStatus("error");
      setMessage(friendlySaveError(raw));
      const stored = loadPlayerSession();
      if (stored) {
        setNav({
          code: stored.code,
          nextExercise: null,
          allDone: false,
        });
      }
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

  if (status === "idle") return null;

  const nextTest = nav?.nextExercise
    ? TESTS.find((test) => test.slug === nav.nextExercise)
    : null;

  return (
    <div className="flex flex-col gap-3">
      <p
        className={`rounded-xl border px-3 py-2 text-sm ${
          status === "error"
            ? "border-danger/40 text-danger"
            : status === "saved"
              ? "border-brand/40 text-brand"
              : "border-border text-muted"
        }`}
      >
        {status === "saving" ? "Envoi du résultat…" : message}
      </p>

      {status === "error" ? (
        <Button
          onClick={() => {
            attemptKey.current = null;
            void save();
          }}
        >
          Réessayer l&apos;envoi
        </Button>
      ) : null}

      {nav && status !== "saving" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {status === "saved" && nav.nextExercise && !nav.allDone ? (
            <Link
              href={`/play/${nav.code}/${nav.nextExercise}`}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white"
            >
              Exercice suivant
              {nextTest ? ` : ${nextTest.name}` : ""}
            </Link>
          ) : null}
          {status === "saved" && nav.allDone ? (
            <p className="flex-1 rounded-xl border border-brand/40 bg-brand-soft px-3 py-3 text-center text-sm text-brand">
              Tous les exercices sont terminés. Bravo !
            </p>
          ) : null}
          <Link
            href={`/play/${nav.code}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-border bg-surface px-6 font-semibold"
          >
            Retour à la session
          </Link>
        </div>
      )}
    </div>
  );
}
