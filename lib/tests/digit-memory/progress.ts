import { calculateAccuracy } from "@/lib/tests/scoring";
import { readChallenge, signChallenge } from "@/lib/tests/challenge-token";
import { DIGIT_LEVELS, DIGIT_VISIBLE_MS, digitLength } from "./config";
import { digitSequence, gradeDigitSequence } from "./sequence";

export type DigitToken = {
  kind: "digit-memory";
  sessionPlayerId: string;
  sessionId: string;
  level: number;
  phase: "present" | "answer";
  shown: number;
  lastDigitAt: number;
  levelsCompleted: number;
  maximumDigitsMemorized: number;
  totalDigitsPresented: number;
  totalCorrectDigits: number;
  sequenceAttempts: number;
  incorrectSequences: number;
  startedAt: number;
};

export function beginDigitAttempt(sessionPlayerId: string, sessionId: string, now: number, secret: string) {
  const token: DigitToken = {
    kind: "digit-memory",
    sessionPlayerId,
    sessionId,
    level: 1,
    phase: "present",
    shown: 0,
    lastDigitAt: 0,
    levelsCompleted: 0,
    maximumDigitsMemorized: 0,
    totalDigitsPresented: 0,
    totalCorrectDigits: 0,
    sequenceAttempts: 0,
    incorrectSequences: 0,
    startedAt: now,
  };
  return signChallenge(token, secret);
}

export function revealNextDigit(signed: string, secret: string, now: number) {
  const token = readChallenge<DigitToken>(signed, secret);
  if (!token || token.kind !== "digit-memory") return { error: "Jeton invalide." as const };
  if (token.phase !== "present") return { error: "La séquence est déjà terminée." as const };
  const length = digitLength(token.level);
  if (!length || token.shown >= length) return { error: "Chiffre indisponible." as const };
  if (token.shown > 0 && now < token.lastDigitAt + DIGIT_VISIBLE_MS) {
    return { error: "Trop tôt." as const };
  }
  const digit = digitSequence(token.sessionId, token.level, secret)[token.shown];
  const shown = token.shown + 1;
  const next: DigitToken = {
    ...token,
    shown,
    lastDigitAt: now,
    phase: shown >= length ? "answer" : "present",
  };
  return {
    digit,
    shown,
    length,
    answer: next.phase === "answer",
    token: signChallenge(next, secret),
  };
}

export function answerDigitSequence(
  signed: string,
  answer: number[],
  secret: string,
  now: number,
) {
  const token = readChallenge<DigitToken>(signed, secret);
  if (!token || token.kind !== "digit-memory") return { error: "Jeton invalide." as const };
  if (token.phase !== "answer") return { error: "La séquence n'est pas terminée." as const };
  if (!answer.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)) {
    return { error: "Réponse invalide." as const };
  }
  const expected = digitSequence(token.sessionId, token.level, secret);
  const grade = gradeDigitSequence(expected, answer);
  const next: DigitToken = {
    ...token,
    sequenceAttempts: token.sequenceAttempts + 1,
    totalDigitsPresented: token.totalDigitsPresented + expected.length,
    totalCorrectDigits: token.totalCorrectDigits + grade.positional,
    incorrectSequences: token.incorrectSequences + (grade.exact ? 0 : 1),
    levelsCompleted: token.levelsCompleted + (grade.exact ? 1 : 0),
    maximumDigitsMemorized: grade.exact
      ? Math.max(token.maximumDigitsMemorized, expected.length)
      : token.maximumDigitsMemorized,
  };
  const finished = !grade.exact || token.level >= DIGIT_LEVELS.length;
  if (!finished) {
    const advanced: DigitToken = {
      ...next,
      level: token.level + 1,
      phase: "present",
      shown: 0,
      lastDigitAt: 0,
    };
    return {
      exact: true,
      positional: grade.positional,
      positionErrors: grade.positionErrors,
      finished: false as const,
      level: advanced.level,
      length: digitLength(advanced.level),
      token: signChallenge(advanced, secret),
    };
  }
  return {
    exact: grade.exact,
    positional: grade.positional,
    positionErrors: grade.positionErrors,
    finished: true as const,
    sessionPlayerId: token.sessionPlayerId,
    result: buildDigitResult(next, now),
  };
}

export function buildDigitResult(token: DigitToken, now: number) {
  const presented = token.totalDigitsPresented;
  const missed = Math.max(0, presented - token.totalCorrectDigits);
  const accuracy = calculateAccuracy(token.totalCorrectDigits, missed);
  return {
    score: token.maximumDigitsMemorized,
    accuracy,
    correctAnswers: token.totalCorrectDigits,
    errors: token.incorrectSequences,
    averageReactionMs: 0,
    bestReactionMs: 0,
    durationMs: Math.max(1, now - token.startedAt),
    metrics: {
      levelsCompleted: token.levelsCompleted,
      maximumDigitsMemorized: token.maximumDigitsMemorized,
      totalDigitsPresented: presented,
      totalCorrectDigits: token.totalCorrectDigits,
      sequenceAttempts: token.sequenceAttempts,
      incorrectSequences: token.incorrectSequences,
      completionTimeMs: Math.max(1, now - token.startedAt),
      completionStatus: "completed" as const,
      scoringVersion: "digit-memory-1",
    },
  };
}

export function digitResultLines(result: {
  errors: number;
  durationMs: number;
  completedAt?: string;
  metrics: Record<string, unknown> | null;
}) {
  const metrics = result.metrics ?? {};
  if (metrics.scoringVersion !== "digit-memory-1") return null;
  const lines = [
    { label: "Chiffres retenus", value: String(metrics.maximumDigitsMemorized ?? 0) },
    { label: "Niveaux réussis", value: String(metrics.levelsCompleted ?? 0) },
    { label: "Suites incorrectes", value: String(result.errors) },
    { label: "Temps", value: `${Math.round(result.durationMs / 1000)} s` },
  ];
  if (result.completedAt) {
    lines.push({ label: "Terminé", value: formatStamp(result.completedAt) });
  }
  return lines;
}

export function digitHeadline(metrics: Record<string, unknown> | null) {
  if (metrics?.scoringVersion !== "digit-memory-1") return null;
  return `${metrics.maximumDigitsMemorized ?? 0} chiffres`;
}

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
