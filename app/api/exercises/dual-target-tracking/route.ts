import { jsonError, jsonOk } from "@/lib/api/http";
import { submitResult } from "@/lib/sessions/service";
import { openChallenge } from "@/lib/tests/challenge-access";
import { challengeSecret } from "@/lib/tests/challenge-token";
import { beginDualAttempt, gradeDualRound } from "@/lib/tests/dual-target-tracking/progress";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      sessionPlayerId?: string;
      token?: string;
      selected?: number[];
    };
    const secret = challengeSecret();
    const now = Date.now();

    if (body.action === "start") {
      if (!body.sessionPlayerId) return jsonError("Joueur requis.");
      const access = await openChallenge(body.sessionPlayerId, "dual-target-tracking");
      if (!access.ok) return jsonError(access.error, access.status);
      return jsonOk(beginDualAttempt(access.player.id, access.session.id, now, secret));
    }

    if (body.action === "submit") {
      if (!body.token || !Array.isArray(body.selected)) return jsonError("Sélection incomplète.");
      const graded = gradeDualRound(body.token, body.selected, secret, now);
      if ("error" in graded && graded.error) return jsonError(graded.error);
      if (!graded.finished) {
        return jsonOk({
          both: graded.both,
          correctlyIdentifiedTargets: graded.correctlyIdentifiedTargets,
          finished: false,
          token: graded.token,
          challenge: graded.challenge,
        });
      }
      const saved = await submitResult({
        sessionPlayerId: graded.sessionPlayerId,
        testSlug: "dual-target-tracking",
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
        both: graded.both,
        correctlyIdentifiedTargets: graded.correctlyIdentifiedTargets,
        finished: true,
        summary: {
          correctlyIdentifiedTargets: graded.result.metrics.correctlyIdentifiedTargets,
          incorrectSelections: graded.result.metrics.incorrectSelections,
          difficultyLevelReached: graded.result.metrics.difficultyLevelReached,
          accuracy: graded.result.accuracy,
        },
      });
    }

    return jsonError("Action inconnue.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "missing_challenge_secret") {
      return jsonError("Configuration du serveur incomplète.", 500);
    }
    console.error("dual-target-tracking", message || "failed");
    return jsonError("Impossible de continuer l'exercice.", 500);
  }
}
