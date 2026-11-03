import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  aiReports,
  sessionExercises,
  sessionPlayers,
  testResults,
  trainingSessions,
} from "@/lib/db/drizzle-schema";
import type { PlayerBundle } from "./analysis-context";
import type { AnalysisStore } from "./analysis-orchestrator";
import type { ReportContent, ReportKey, StoredReport } from "./types";
import { PROMPT_VERSION } from "./types";

function toStored(row: typeof aiReports.$inferSelect): StoredReport {
  return {
    id: row.id,
    sessionId: row.sessionId,
    sessionPlayerId: row.sessionPlayerId,
    testResultId: row.testResultId,
    reportType: row.reportType,
    status: row.status,
    reportData: (row.reportData as StoredReport["reportData"]) ?? null,
    model: row.model,
    promptVersion: row.promptVersion,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    errorCode: row.errorCode,
    generatedAt: row.generatedAt?.toISOString() ?? null,
  };
}

function matchKey(key: ReportKey) {
  const base = [
    eq(aiReports.sessionPlayerId, key.sessionPlayerId),
    eq(aiReports.sessionId, key.sessionId),
    eq(aiReports.reportType, key.reportType),
  ];
  if (key.testResultId) {
    base.push(eq(aiReports.testResultId, key.testResultId));
  }
  return and(...base);
}

export function createAnalysisStore(): AnalysisStore {
  return {
    async loadPlayer(sessionPlayerId) {
      const db = getDb();
      const [player] = await db
        .select({
          sessionPlayerId: sessionPlayers.id,
          displayName: sessionPlayers.displayName,
          sessionId: trainingSessions.id,
          coachId: trainingSessions.coachId,
        })
        .from(sessionPlayers)
        .innerJoin(
          trainingSessions,
          eq(trainingSessions.id, sessionPlayers.sessionId),
        )
        .where(eq(sessionPlayers.id, sessionPlayerId))
        .limit(1);
      if (!player) return null;

      const assigned = await db
        .select({ testSlug: sessionExercises.testSlug })
        .from(sessionExercises)
        .where(eq(sessionExercises.sessionId, player.sessionId));
      const results = await db
        .select()
        .from(testResults)
        .where(eq(testResults.sessionPlayerId, sessionPlayerId));
      const slugs = [...new Set(results.map((item) => item.testSlug))];
      const cohortRows = slugs.length
        ? await db
            .select({ testSlug: testResults.testSlug, score: testResults.score })
            .from(testResults)
            .where(inArray(testResults.testSlug, slugs))
        : [];
      const cohortScores: Record<string, number[]> = {};
      for (const row of cohortRows) {
        (cohortScores[row.testSlug] ??= []).push(row.score);
      }

      const historyPlayers = await db
        .select({
          id: sessionPlayers.id,
          sessionId: sessionPlayers.sessionId,
          joinedAt: sessionPlayers.joinedAt,
        })
        .from(sessionPlayers)
        .innerJoin(
          trainingSessions,
          eq(trainingSessions.id, sessionPlayers.sessionId),
        )
        .where(
          and(
            eq(trainingSessions.coachId, player.coachId),
            ne(sessionPlayers.sessionId, player.sessionId),
            sql`lower(${sessionPlayers.displayName}) = lower(${player.displayName})`,
          ),
        );

      const history: PlayerBundle["history"] = [];
      for (const previous of historyPlayers) {
        const previousResults = await db
          .select()
          .from(testResults)
          .where(eq(testResults.sessionPlayerId, previous.id));
        if (previousResults.length === 0) continue;
        history.push({
          sessionId: previous.sessionId,
          completedAt: previous.joinedAt.toISOString(),
          results: previousResults.map(mapResult),
        });
      }

      return {
        sessionId: player.sessionId,
        sessionPlayerId: player.sessionPlayerId,
        displayName: player.displayName,
        assigned: assigned.map((item) => item.testSlug),
        results: results.map(mapResult),
        cohortScores,
        history,
      };
    },

    async findReport(key) {
      const db = getDb();
      const [row] = await db
        .select()
        .from(aiReports)
        .where(matchKey(key))
        .limit(1);
      return row ? toStored(row) : null;
    },

    async claim(key) {
      const db = getDb();
      const existing = await this.findReport(key);
      if (existing) {
        await db
          .update(aiReports)
          .set({ status: "processing", errorCode: null, updatedAt: new Date() })
          .where(eq(aiReports.id, existing.id));
        return { ...existing, status: "processing", errorCode: null };
      }
      const [created] = await db
        .insert(aiReports)
        .values({
          sessionId: key.sessionId,
          sessionPlayerId: key.sessionPlayerId,
          testResultId: key.testResultId,
          reportType: key.reportType,
          status: "processing",
          promptVersion: PROMPT_VERSION,
        })
        .returning();
      return toStored(created);
    },

    async complete(id, data: ReportContent, usage) {
      const db = getDb();
      await db
        .update(aiReports)
        .set({
          status: "completed",
          reportData: data,
          model: usage.model,
          promptVersion: PROMPT_VERSION,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          errorCode: null,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiReports.id, id));
    },

    async fail(id, errorCode) {
      const db = getDb();
      await db
        .update(aiReports)
        .set({
          status: "failed",
          errorCode,
          updatedAt: new Date(),
        })
        .where(eq(aiReports.id, id));
    },

    async markIneligible(key, reason) {
      const existing = await this.findReport(key);
      const db = getDb();
      if (existing) {
        await db
          .update(aiReports)
          .set({
            status: "not_eligible",
            reportData: { reason },
            errorCode: null,
            updatedAt: new Date(),
          })
          .where(eq(aiReports.id, existing.id));
        return;
      }
      await db.insert(aiReports).values({
        sessionId: key.sessionId,
        sessionPlayerId: key.sessionPlayerId,
        testResultId: key.testResultId,
        reportType: key.reportType,
        status: "not_eligible",
        reportData: { reason },
        promptVersion: PROMPT_VERSION,
      });
    },
  };
}

function mapResult(row: typeof testResults.$inferSelect) {
  return {
    id: row.id,
    testSlug: row.testSlug,
    score: row.score,
    accuracy: Number(row.accuracy),
    correctAnswers: row.correctAnswers,
    errors: row.errors,
    averageReactionMs: row.averageReactionMs,
    bestReactionMs: row.bestReactionMs,
    durationMs: row.durationMs,
    metrics: (row.metrics ?? {}) as Record<string, unknown>,
    completedAt: row.completedAt,
  };
}

export async function listPlayerReports(sessionPlayerId: string, coachId: string) {
  const db = getDb();
  const [player] = await db
    .select({
      coachId: trainingSessions.coachId,
      displayName: sessionPlayers.displayName,
      sessionId: trainingSessions.id,
      startsAt: trainingSessions.startsAt,
    })
    .from(sessionPlayers)
    .innerJoin(trainingSessions, eq(trainingSessions.id, sessionPlayers.sessionId))
    .where(eq(sessionPlayers.id, sessionPlayerId))
    .limit(1);
  if (!player || player.coachId !== coachId) return null;

  const reports = await db
    .select()
    .from(aiReports)
    .where(eq(aiReports.sessionPlayerId, sessionPlayerId))
    .orderBy(desc(aiReports.createdAt));

  const usageRows = await db
    .select({
      status: aiReports.status,
      model: aiReports.model,
      inputTokens: aiReports.inputTokens,
      outputTokens: aiReports.outputTokens,
    })
    .from(aiReports)
    .innerJoin(trainingSessions, eq(trainingSessions.id, aiReports.sessionId))
    .where(eq(trainingSessions.coachId, coachId));

  return {
    player,
    reports: reports.map(toStored),
    usage: {
      reports: usageRows.length,
      failed: usageRows.filter((row) => row.status === "failed").length,
      inputTokens: usageRows.reduce((sum, row) => sum + row.inputTokens, 0),
      outputTokens: usageRows.reduce((sum, row) => sum + row.outputTokens, 0),
      models: [...new Set(usageRows.map((row) => row.model).filter(Boolean))],
    },
  };
}
