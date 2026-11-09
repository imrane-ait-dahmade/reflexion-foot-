import { jsonError, jsonOk } from "@/lib/api/http";
import { challengeSecret } from "@/lib/tests/challenge-token";
import { openChallenge } from "@/lib/tests/challenge-access";
import { digitLength } from "@/lib/tests/digit-memory/config";
import {
  answerDigitSequence,
  beginDigitAttempt,
  revealNextDigit,
} from "@/lib/tests/digit-memory/progress";
import { submitResult } from "@/lib/sessions/service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      sessionPlayerId?: string;
      token?: string;
      answer?: number[];
    };
    const secret = challengeSecret();
    const now = Date.now();

    if (body.action === "start") {
      if (!body.sessionPlayerId) return jsonError("Joueur requis.");
      const access = await openChallenge(body.sessionPlayerId, "digit-memory");
      if (!access.ok) return jsonError(access.error, access.status);
      return jsonOk({
        token: beginDigitAttempt(access.player.id, access.session.id, now, secret),
        level: 1,
        length: digitLength(1),
      });
    }

    if (body.action === "digit") {
      if (!body.token) return jsonError("Jeton requis.");
      const revealed = revealNextDigit(body.token, secret, now);
      if ("error" in revealed && revealed.error) return jsonError(revealed.error);
      return jsonOk(revealed);
    }

    if (body.action === "answer") {
      if (!body.token || !Array.isArray(body.answer)) return jsonError("Réponse incomplète.");
      const graded = answerDigitSequence(body.token, body.answer, secret, now);
      if ("error" in graded && graded.error) return jsonError(graded.error);
      if (!graded.finished) {
        return jsonOk({
          exact: graded.exact,
          positional: graded.positional,
          positionErrors: graded.positionErrors,
          finished: false,
          level: graded.level,
          length: graded.length,
          token: graded.token,
        });
      }
      const saved = await submitResult({
        sessionPlayerId: graded.sessionPlayerId,
        testSlug: "digit-memory",
        score: graded.result.score,
        accuracy: graded.result.accuracy,
        correctAnswers: graded.result.correctAnswers,
        errors: graded.result.errors,
        averageReactionMs: 0,
        bestReactionMs: 0,
        durationMs: graded.result.durationMs,
        metrics: graded.result.metrics,
      });
      if (!saved.ok) return jsonError(saved.error, 400);
      return jsonOk({
        exact: graded.exact,
        positional: graded.positional,
        positionErrors: graded.positionErrors,
        finished: true,
        summary: {
          maximumDigitsMemorized: graded.result.metrics.maximumDigitsMemorized,
          levelsCompleted: graded.result.metrics.levelsCompleted,
          incorrectSequences: graded.result.errors,
        },
      });
    }

    return jsonError("Action inconnue.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "missing_challenge_secret") {
      return jsonError("Configuration du serveur incomplète.", 500);
    }
    console.error("digit-memory", message || "failed");
    return jsonError("Impossible de continuer l'exercice.", 500);
  }
}
