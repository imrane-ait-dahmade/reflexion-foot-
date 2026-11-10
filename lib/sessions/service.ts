import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  sessionExercises,
  sessionPlayers,
  testResults,
  trainingSessions,
} from "@/lib/db/drizzle-schema";
import type { TestSlug } from "@/lib/db/types";
import { canAcceptResult, isJoinable } from "./access";
import { generateSessionCode } from "./code";
import { SESSION_DURATION_MS } from "./config";
import { pickRandomExercises, shuffleSlugs } from "./exercises";

type SessionRow = typeof trainingSessions.$inferSelect;

/** Closes the session in DB if its end time has passed. */
async function ensureSessionNotExpired(session: SessionRow) {
  if (session.status !== "active") return session;
  if (!session.endsAt || session.endsAt.getTime() > Date.now()) return session;

  const db = getDb();
  const [closed] = await db
    .update(trainingSessions)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(trainingSessions.id, session.id))
    .returning();
  return closed ?? { ...session, status: "closed" as const };
}

async function createUniqueCode() {
  const db = getDb();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateSessionCode();
    const existing = await db
      .select({ id: trainingSessions.id })
      .from(trainingSessions)
      .where(eq(trainingSessions.code, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error("Could not generate a unique session code.");
}

export type CreateSessionInput = {
  coachId: string;
  title: string;
  exerciseCount?: number;
  /** If provided, uses these instead of random picks. */
  testSlugs?: TestSlug[];
};

export async function createActiveSession(input: CreateSessionInput) {
  const db = getDb();
  const code = await createUniqueCode();
  const exerciseCount = Math.min(Math.max(input.exerciseCount ?? 2, 1), 4);
  // Coach picks which tests; play order is always shuffled for the player.
  const slugs = shuffleSlugs(
    input.testSlugs && input.testSlugs.length > 0
      ? [...new Set(input.testSlugs)]
      : pickRandomExercises(exerciseCount),
  );

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + SESSION_DURATION_MS);

  const [session] = await db
    .insert(trainingSessions)
    .values({
      coachId: input.coachId,
      code,
      title: input.title.trim(),
      status: "active",
      randomizeExercises: true,
      exerciseCount: slugs.length,
      startsAt,
      endsAt,
    })
    .returning();

  await db.insert(sessionExercises).values(
    slugs.map((testSlug, sortOrder) => ({
      sessionId: session.id,
      testSlug,
      sortOrder,
    })),
  );

  return { session, exercises: slugs };
}

export async function getSessionByCode(code: string) {
  const db = getDb();
  const normalized = code.trim().toUpperCase();
  const [raw] = await db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.code, normalized))
    .limit(1);
  if (!raw) return null;

  const session = await ensureSessionNotExpired(raw);

  const exercises = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, session.id))
    .orderBy(asc(sessionExercises.sortOrder));

  return { session, exercises };
}

export async function joinSession(code: string, displayName: string) {
  const db = getDb();
  const found = await getSessionByCode(code);
  if (!found) {
    return { ok: false as const, error: "Session introuvable." };
  }
  if (!isJoinable(found.session)) {
    return {
      ok: false as const,
      error: "Cette session est fermée ou a expiré.",
    };
  }

  const name = displayName.trim();
  if (name.length < 2) {
    return { ok: false as const, error: "Le nom doit contenir au moins 2 caractères." };
  }

  try {
    const [player] = await db
      .insert(sessionPlayers)
      .values({
        sessionId: found.session.id,
        displayName: name,
      })
      .returning();

    return {
      ok: true as const,
      session: found.session,
      exercises: found.exercises,
      player,
    };
  } catch {
    return {
      ok: false as const,
      error: "Ce nom est déjà utilisé dans cette session.",
    };
  }
}

export type SubmitResultInput = {
  sessionPlayerId: string;
  testSlug: TestSlug;
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionMs: number;
  bestReactionMs: number;
  durationMs: number;
  metrics?: Record<string, unknown>;
};

export async function submitResult(input: SubmitResultInput) {
  const db = getDb();

  const [row] = await db
    .select({
      playerId: sessionPlayers.id,
      session: trainingSessions,
      exerciseId: sessionExercises.id,
      existingId: testResults.id,
      existingScore: testResults.score,
    })
    .from(sessionPlayers)
    .innerJoin(
      trainingSessions,
      eq(trainingSessions.id, sessionPlayers.sessionId),
    )
    .leftJoin(
      sessionExercises,
      and(
        eq(sessionExercises.sessionId, sessionPlayers.sessionId),
        eq(sessionExercises.testSlug, input.testSlug),
      ),
    )
    .leftJoin(
      testResults,
      and(
        eq(testResults.sessionPlayerId, sessionPlayers.id),
        eq(testResults.testSlug, input.testSlug),
      ),
    )
    .where(eq(sessionPlayers.id, input.sessionPlayerId))
    .limit(1);
  if (!row) {
    return { ok: false as const, error: "Joueur introuvable." };
  }

  const currentSession = await ensureSessionNotExpired(row.session);
  if (!canAcceptResult(currentSession)) {
    return {
      ok: false as const,
      error: "Cette session est fermée ou a expiré.",
    };
  }
  if (!row.exerciseId) {
    return { ok: false as const, error: "Ce test ne fait pas partie de la session." };
  }
  if (row.existingId) {
    return {
      ok: true as const,
      result: { id: row.existingId, score: row.existingScore ?? 0 },
      duplicate: true as const,
    };
  }

  try {
    const [result] = await db
      .insert(testResults)
      .values({
        sessionId: currentSession.id,
        sessionPlayerId: row.playerId,
        testSlug: input.testSlug,
        score: input.score,
        accuracy: String(input.accuracy),
        correctAnswers: input.correctAnswers,
        errors: input.errors,
        averageReactionMs: input.averageReactionMs,
        bestReactionMs: input.bestReactionMs,
        durationMs: input.durationMs,
        metrics: input.metrics ?? {},
      })
      .returning();

    return { ok: true as const, result };
  } catch {
    const [raceExisting] = await db
      .select()
      .from(testResults)
      .where(
        and(
          eq(testResults.sessionPlayerId, row.playerId),
          eq(testResults.testSlug, input.testSlug),
        ),
      )
      .limit(1);
    if (raceExisting) {
      return {
        ok: true as const,
        result: { id: raceExisting.id, score: raceExisting.score },
        duplicate: true as const,
      };
    }
    return {
      ok: false as const,
      error: "Impossible d'enregistrer le résultat.",
    };
  }
}

export async function listCoachSessions(coachId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: trainingSessions.id,
      code: trainingSessions.code,
      title: trainingSessions.title,
      status: trainingSessions.status,
      createdAt: trainingSessions.createdAt,
      endsAt: trainingSessions.endsAt,
      exerciseCount: trainingSessions.exerciseCount,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.coachId, coachId))
    .orderBy(sql`${trainingSessions.createdAt} desc`);

  // Refresh expired statuses so the coach list stays accurate.
  return Promise.all(
    rows.map(async (row) => {
      if (row.status !== "active" || !row.endsAt) return row;
      if (row.endsAt.getTime() > Date.now()) return row;
      const [closed] = await db
        .update(trainingSessions)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(trainingSessions.id, row.id))
        .returning({
          id: trainingSessions.id,
          code: trainingSessions.code,
          title: trainingSessions.title,
          status: trainingSessions.status,
          createdAt: trainingSessions.createdAt,
          endsAt: trainingSessions.endsAt,
          exerciseCount: trainingSessions.exerciseCount,
        });
      return closed ?? { ...row, status: "closed" as const };
    }),
  );
}

export async function closeSession(code: string, coachId: string) {
  const found = await getSessionByCode(code);
  if (!found) return { ok: false as const, error: "Session introuvable." };
  if (found.session.coachId !== coachId) {
    return { ok: false as const, error: "Session introuvable." };
  }

  const db = getDb();
  const [session] = await db
    .update(trainingSessions)
    .set({
      status: "closed",
      endsAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(trainingSessions.id, found.session.id))
    .returning();

  return { ok: true as const, session };
}

export async function getPlayerProgress(sessionPlayerId: string) {
  const db = getDb();
  const [player] = await db
    .select()
    .from(sessionPlayers)
    .where(eq(sessionPlayers.id, sessionPlayerId))
    .limit(1);
  if (!player) return null;

  const [rawSession] = await db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, player.sessionId))
    .limit(1);
  if (!rawSession) return null;
  const session = await ensureSessionNotExpired(rawSession);

  const exerciseRows = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, session.id))
    .orderBy(asc(sessionExercises.sortOrder));

  const results = await db
    .select({
      testSlug: testResults.testSlug,
      score: testResults.score,
      accuracy: testResults.accuracy,
      completedAt: testResults.completedAt,
    })
    .from(testResults)
    .where(eq(testResults.sessionPlayerId, sessionPlayerId));

  const completed = new Map(
    results.map((result) => [result.testSlug, result] as const),
  );
  const exercises = exerciseRows.map((exercise) => {
    const done = completed.get(exercise.testSlug);
    return {
      testSlug: exercise.testSlug as TestSlug,
      sortOrder: exercise.sortOrder,
      completed: Boolean(done),
      score: done?.score ?? null,
      accuracy: done ? Number(done.accuracy) : null,
    };
  });

  const nextExercise =
    exercises.find((exercise) => !exercise.completed)?.testSlug ?? null;

  return {
    session: {
      id: session.id,
      code: session.code,
      title: session.title,
      status: session.status,
      endsAt: session.endsAt,
    },
    player: {
      id: player.id,
      displayName: player.displayName,
    },
    exercises,
    completedCount: exercises.filter((exercise) => exercise.completed).length,
    totalCount: exercises.length,
    nextExercise,
    allDone: exercises.every((exercise) => exercise.completed),
  };
}

export async function getSessionDashboard(
  code: string,
  coachId?: string,
  playerId?: string,
) {
  const found = await getSessionByCode(code);
  if (!found) return null;
  if (coachId && found.session.coachId !== coachId) return null;

  const db = getDb();
  const players = await db
    .select({
      sessionPlayerId: sessionPlayers.id,
      displayName: sessionPlayers.displayName,
      joinedAt: sessionPlayers.joinedAt,
      completedTests: sql<number>`count(${testResults.id})::int`,
      averageScore: sql<string | null>`round(avg(case when ${testResults.testSlug} in ('visual-tracking', 'visual-memory', 'reaction-time', 'peripheral-vision', 'football-visual-scanning') then ${testResults.score} end)::numeric, 1)`,
      totalScore: sql<number | null>`sum(case when ${testResults.testSlug} in ('visual-tracking', 'visual-memory', 'reaction-time', 'peripheral-vision', 'football-visual-scanning') then ${testResults.score} end)::int`,
    })
    .from(sessionPlayers)
    .leftJoin(
      testResults,
      eq(testResults.sessionPlayerId, sessionPlayers.id),
    )
    .where(eq(sessionPlayers.sessionId, found.session.id))
    .groupBy(
      sessionPlayers.id,
      sessionPlayers.displayName,
      sessionPlayers.joinedAt,
    )
    .orderBy(asc(sessionPlayers.joinedAt));

  const results = playerId
    ? await db
        .select()
        .from(testResults)
        .where(
          and(
            eq(testResults.sessionId, found.session.id),
            eq(testResults.sessionPlayerId, playerId),
          ),
        )
    : [];

  return {
    session: found.session,
    exercises: found.exercises,
    players,
    results,
  };
}
