import { jsonError, jsonOk } from "@/lib/api/http";
import { getPlayerProgress } from "@/lib/sessions/service";

type Params = { params: Promise<{ sessionPlayerId: string }> };

/** Player-facing progress — never expose scores. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { sessionPlayerId } = await params;
    const progress = await getPlayerProgress(sessionPlayerId);
    if (!progress) {
      return jsonError("Joueur introuvable.", 404);
    }

    return jsonOk({
      session: progress.session,
      player: progress.player,
      exercises: progress.exercises.map((exercise) => ({
        testSlug: exercise.testSlug,
        sortOrder: exercise.sortOrder,
        completed: exercise.completed,
      })),
      completedCount: progress.completedCount,
      totalCount: progress.totalCount,
      nextExercise: progress.nextExercise,
      allDone: progress.allDone,
    });
  } catch (error) {
    console.error(error);
    return jsonError("Impossible de charger la progression.", 500);
  }
}
