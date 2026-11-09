import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  sessionExercises,
  sessionPlayers,
  testResults,
  trainingSessions,
} from "@/lib/db/drizzle-schema";
import type { TestSlug } from "@/lib/db/types";
import { canAcceptResult } from "@/lib/sessions/access";

export async function openChallenge(sessionPlayerId: string, slug: TestSlug) {
  const db = getDb();
  const [player] = await db
    .select()
    .from(sessionPlayers)
    .where(eq(sessionPlayers.id, sessionPlayerId))
    .limit(1);
  if (!player) return { ok: false as const, error: "Joueur introuvable.", status: 404 };

  const [session] = await db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, player.sessionId))
    .limit(1);
  if (!session || !canAcceptResult(session)) {
    return { ok: false as const, error: "Cette session est fermée ou a expiré.", status: 400 };
  }

  const [exercise] = await db
    .select({ id: sessionExercises.id })
    .from(sessionExercises)
    .where(
      and(
        eq(sessionExercises.sessionId, player.sessionId),
        eq(sessionExercises.testSlug, slug),
      ),
    )
    .limit(1);
  if (!exercise) {
    return { ok: false as const, error: "Ce test ne fait pas partie de la session.", status: 400 };
  }

  const [existing] = await db
    .select({ id: testResults.id })
    .from(testResults)
    .where(
      and(eq(testResults.sessionPlayerId, player.id), eq(testResults.testSlug, slug)),
    )
    .limit(1);
  if (existing) return { ok: false as const, error: "Déjà enregistré.", status: 409, already: true };

  return { ok: true as const, player, session };
}
