"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Pitch } from "@/components/tests/football-visual-scanning/Pitch";
import { loadPlayerSession } from "@/lib/sessions/player-session";
import { submitClientResult } from "@/lib/sessions/submit-client";
import {
  CHALLENGE_LABEL,
  SCANNING_ATTRIBUTION,
  SCANNING_LIMIT_MS,
  SCANNING_SEQUENCES,
  correctPlayer,
  type ChallengeType,
} from "@/lib/tests/football-visual-scanning/answers";

type Attempt = {
  index: number;
  challenge: ChallengeType;
  playerId: string | null;
  correct: boolean;
  missed: boolean;
  responseMs: number;
};

type FootballVisualScanningTestProps = {
  sessionPlayerId?: string;
  stepIndex?: number;
  stepTotal?: number;
};

export function FootballVisualScanningTest({
  sessionPlayerId,
  stepIndex,
  stepTotal,
}: FootballVisualScanningTestProps = {}) {
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const startedAt = useRef(0);
  const locked = useRef(false);
  const saved = useRef(false);
  const [clock, setClock] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [exerciseStartedAt, setExerciseStartedAt] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");

  const sequence = SCANNING_SEQUENCES[index];

  const finishAttempt = (attempt: Attempt) => {
    const next = [...attempts, attempt];
    setAttempts(next);
    if (next.length >= SCANNING_SEQUENCES.length) {
      setPhase("finished");
      return;
    }
    setIndex(next.length);
    const now = performance.now();
    startedAt.current = now;
    setQuestionStartedAt(now);
    setClock(now);
    locked.current = false;
  };

  const begin = () => {
    const now = performance.now();
    setAttempts([]);
    setIndex(0);
    setFeedback(null);
    setPhase("running");
    startedAt.current = now;
    setExerciseStartedAt(now);
    setQuestionStartedAt(now);
    setClock(now);
    locked.current = false;
  };

  const answer = (playerId: string | null) => {
    if (phase !== "running" || locked.current || !sequence) return;
    const elapsed = performance.now() - startedAt.current;
    locked.current = true;
    const expected = correctPlayer(sequence);
    const missed = playerId === null;
    const correct = playerId === expected.playerId;
    setFeedback(
      missed
        ? `Temps écoulé. Réponse : ${expected.teamId === "home" ? "vert" : "blanc"} #${expected.playerId}`
        : correct
          ? "Correct"
          : `Non. Réponse : #${expected.playerId}`,
    );
    window.setTimeout(() => {
      setFeedback(null);
      finishAttempt({
        index,
        challenge: sequence.challenge,
        playerId,
        correct,
        missed,
        responseMs: missed ? SCANNING_LIMIT_MS : elapsed,
      });
    }, 700);
  };

  useEffect(() => {
    if (phase !== "finished" || !sessionPlayerId || saved.current) return;
    saved.current = true;
    const correctCount = attempts.filter((item) => item.correct).length;
    const missedCount = attempts.filter((item) => item.missed).length;
    const incorrectCount = attempts.length - correctCount - missedCount;
    const times = attempts.map((item) => item.responseMs);
    const average = Math.round(
      times.reduce((sum, value) => sum + value, 0) / Math.max(times.length, 1),
    );
    const best = Math.min(...times);
    const score = Math.round((correctCount / Math.max(attempts.length, 1)) * 100);
    const breakdown = (["closest", "defender", "free"] as const).reduce(
      (acc, type) => {
        const rows = attempts.filter((item) => item.challenge === type);
        acc[`${type}Correct`] = rows.filter((item) => item.correct).length;
        acc[`${type}Total`] = rows.length;
        return acc;
      },
      {} as Record<string, number>,
    );

    void submitClientResult({
      sessionPlayerId,
      testSlug: "football-visual-scanning",
      score,
      accuracy: score,
      correctAnswers: correctCount,
      errors: incorrectCount + missedCount,
      averageReactionMs: average,
      bestReactionMs: Number.isFinite(best) ? best : 0,
      durationMs: times.reduce((sum, value) => sum + value, 0),
      metrics: {
        missed: missedCount,
        incorrect: incorrectCount,
        ...breakdown,
        attempts: attempts.map((item) => ({
          index: item.index,
          playerId: item.playerId,
          responseMs: Math.round(item.responseMs),
        })),
      },
    })
      .then(() => setSaveMessage("Résultat envoyé à l'entraîneur."))
      .catch((error: Error) => setSaveMessage(error.message));
  }, [attempts, phase, sessionPlayerId]);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => setClock(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setTimeout(() => answer(null), SCANNING_LIMIT_MS);
    return () => window.clearTimeout(id);
    // Restart the limit whenever a new situation is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  if (phase === "finished") {
    const correct = attempts.filter((item) => item.correct).length;
    const missed = attempts.filter((item) => item.missed).length;
    const incorrect = attempts.length - correct - missed;
    const average =
      attempts.reduce((sum, item) => sum + item.responseMs, 0) /
      Math.max(attempts.length, 1);
    const types: ChallengeType[] = ["closest", "defender", "free"];

    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Lecture du jeu</h2>
        <p className="text-xs text-muted">
          Exercice d&apos;observation sur données de tracking. Ce n&apos;est pas
          un score scientifique de performance.
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">Score</dt>
            <dd className="text-2xl font-bold text-brand">
              {Math.round((correct / attempts.length) * 100)}
              <span className="text-base text-muted">/100</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Temps moyen</dt>
            <dd className="text-2xl font-bold tabular-nums">
              {Math.round(average)} ms
            </dd>
          </div>
          <div>
            <dt className="text-muted">Correct</dt>
            <dd className="font-semibold">{correct}</dd>
          </div>
          <div>
            <dt className="text-muted">Incorrect / manqué</dt>
            <dd className="font-semibold">
              {incorrect} / {missed}
            </dd>
          </div>
        </dl>
        <ul className="flex flex-col gap-1 text-sm">
          {types.map((type) => {
            const rows = attempts.filter((item) => item.challenge === type);
            const hits = rows.filter((item) => item.correct).length;
            return (
              <li key={type} className="flex justify-between border-b border-border py-1">
                <span>{CHALLENGE_LABEL[type]}</span>
                <span className="tabular-nums">
                  {hits}/{rows.length}
                </span>
              </li>
            );
          })}
        </ul>
        {sessionPlayerId ? (
          <p className="text-sm text-brand">
            {saveMessage || "Envoi du résultat…"}
          </p>
        ) : (
          <Button onClick={begin}>Recommencer</Button>
        )}
        {sessionPlayerId && loadPlayerSession() ? (
          <Link
            href={`/play/${loadPlayerSession()?.code}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 font-semibold"
          >
            Retour à la session
          </Link>
        ) : null}
        <p className="text-xs text-muted">{SCANNING_ATTRIBUTION}</p>
      </section>
    );
  }

  if (phase === "idle" || !sequence) {
    return (
      <section className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          <p className="mb-2 font-semibold text-foreground">Lecture du jeu</p>
          <p>
            Neuf situations réelles (Sample Game 1, Metrica Sports). Touche le
            joueur demandé. Vert = domicile, blanc = extérieur, ballon noir et
            blanc.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Le plus proche du ballon.</li>
            <li>Le défenseur adverse le plus proche du ballon.</li>
            <li>Le coéquipier le plus libre (le plus d&apos;espace).</li>
          </ul>
        </div>
        {typeof stepIndex === "number" && typeof stepTotal === "number" ? (
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            Exercice {stepIndex} / {stepTotal}
          </p>
        ) : null}
        <Button onClick={begin}>
          {sessionPlayerId ? "Démarrer l'exercice" : "Commencer"}
        </Button>
        <p className="text-xs text-muted">{SCANNING_ATTRIBUTION}</p>
      </section>
    );
  }

  const remainingMs = Math.max(0, SCANNING_LIMIT_MS - (clock - questionStartedAt));
  const elapsedMs = Math.max(0, clock - exerciseStartedAt);
  const formatSeconds = (value: number) => (value / 1000).toFixed(1);
  const correctSoFar = attempts.filter((item) => item.correct).length;
  const scoreSoFar = Math.round(
    (correctSoFar / SCANNING_SEQUENCES.length) * 100,
  );

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm font-semibold sm:text-base">
        {CHALLENGE_LABEL[sequence.challenge]}
      </p>
      <dl className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface px-2 py-2 text-center">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Progression</dt>
          <dd className="text-base font-semibold tabular-nums">
            {index + 1}/{SCANNING_SEQUENCES.length}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Temps restant</dt>
          <dd className="text-base font-semibold tabular-nums text-brand">
            {formatSeconds(remainingMs)} s
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Temps écoulé</dt>
          <dd className="text-base font-semibold tabular-nums">
            {formatSeconds(elapsedMs)} s
          </dd>
        </div>
      </dl>
      <p className="flex items-baseline justify-between rounded-xl border border-border bg-surface px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">Score</span>
        <span className="text-xl font-bold tabular-nums text-brand">
          {scoreSoFar}
          <span className="text-sm font-semibold text-muted">/100</span>
        </span>
      </p>
      <p className="text-xs text-muted">
        {correctSoFar} bonne{correctSoFar > 1 ? "s" : ""} réponse
        {correctSoFar > 1 ? "s" : ""} sur {SCANNING_SEQUENCES.length}. Une bonne
        réponse augmente le score. Vert domicile · blanc extérieur · ballon
        noir et blanc.
      </p>
      <Pitch
        players={sequence.players}
        ball={sequence.ball}
        disabled={Boolean(feedback)}
        onPick={(playerId) => answer(playerId)}
      />
      {feedback ? (
        <p className="text-center text-sm text-brand">{feedback}</p>
      ) : (
        <Button variant="secondary" onClick={() => answer(null)}>
          Passer
        </Button>
      )}
    </section>
  );
}
