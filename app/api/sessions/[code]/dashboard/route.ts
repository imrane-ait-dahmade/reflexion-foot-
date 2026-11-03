import { jsonError, jsonOk } from "@/lib/api/http";
import { requireCoach } from "@/lib/auth-server";
import { getSessionDashboard } from "@/lib/sessions/service";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const coachAuth = await requireCoach();
    if (!coachAuth) return jsonError("Connexion entraîneur requise.", 401);

    const { code } = await params;
    const dashboard = await getSessionDashboard(code, coachAuth.coach.id);
    if (!dashboard) {
      return jsonError("Session introuvable.", 404);
    }

    return jsonOk({
      session: {
        id: dashboard.session.id,
        code: dashboard.session.code,
        title: dashboard.session.title,
        status: dashboard.session.status,
        endsAt: dashboard.session.endsAt,
      },
      exercises: dashboard.exercises.map((exercise) => ({
        testSlug: exercise.testSlug,
        sortOrder: exercise.sortOrder,
      })),
      players: dashboard.players.map((player) => ({
        sessionPlayerId: player.sessionPlayerId,
        displayName: player.displayName,
        joinedAt: player.joinedAt,
        completedTests: player.completedTests,
        averageScore: Number(player.averageScore),
        totalScore: player.totalScore,
      })),
      results: dashboard.results.map((result) => ({
        id: result.id,
        sessionPlayerId: result.sessionPlayerId,
        testSlug: result.testSlug,
        score: result.score,
        accuracy: Number(result.accuracy),
        correctAnswers: result.correctAnswers,
        errors: result.errors,
        averageReactionMs: result.averageReactionMs,
        bestReactionMs: result.bestReactionMs,
        durationMs: result.durationMs,
        metrics: result.metrics,
        completedAt: result.completedAt,
      })),
    });
  } catch (error) {
    console.error(error);
    return jsonError("Impossible de charger le dashboard.", 500);
  }
}
