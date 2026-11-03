import { jsonError, jsonOk } from "@/lib/api/http";
import { isTestSlug } from "@/lib/sessions/exercises";
import { submitResult } from "@/lib/sessions/service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionPlayerId?: string;
      testSlug?: string;
      score?: number;
      accuracy?: number;
      correctAnswers?: number;
      errors?: number;
      averageReactionMs?: number;
      bestReactionMs?: number;
      durationMs?: number;
      metrics?: Record<string, unknown>;
    };

    if (!body.sessionPlayerId || !body.testSlug || !isTestSlug(body.testSlug)) {
      return jsonError("sessionPlayerId et testSlug valides sont requis.");
    }

    if (
      typeof body.score !== "number" ||
      typeof body.accuracy !== "number" ||
      typeof body.correctAnswers !== "number" ||
      typeof body.errors !== "number"
    ) {
      return jsonError("Champs de score incomplets.");
    }

    const result = await submitResult({
      sessionPlayerId: body.sessionPlayerId,
      testSlug: body.testSlug,
      score: body.score,
      accuracy: body.accuracy,
      correctAnswers: body.correctAnswers,
      errors: body.errors,
      averageReactionMs: body.averageReactionMs ?? 0,
      bestReactionMs: body.bestReactionMs ?? 0,
      durationMs: body.durationMs ?? 0,
      metrics: body.metrics,
    });

    if (!result.ok) {
      return jsonError(result.error, 400);
    }

    return jsonOk({ id: result.result.id, score: result.result.score }, 201);
  } catch (error) {
    console.error(error);
    return jsonError("Impossible d'enregistrer le résultat.", 500);
  }
}
