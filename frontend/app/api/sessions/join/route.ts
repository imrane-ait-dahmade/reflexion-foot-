import { jsonError, jsonOk } from "@/lib/api/http";
import { joinSession } from "@/lib/sessions/service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      displayName?: string;
    };

    if (!body.code || !body.displayName) {
      return jsonError("Code et nom sont requis.");
    }

    const result = await joinSession(body.code, body.displayName);
    if (!result.ok) {
      return jsonError(result.error, 400);
    }

    return jsonOk({
      sessionPlayerId: result.player.id,
      displayName: result.player.displayName,
      session: {
        id: result.session.id,
        code: result.session.code,
        title: result.session.title,
        status: result.session.status,
      },
      exercises: result.exercises.map((exercise) => ({
        testSlug: exercise.testSlug,
        sortOrder: exercise.sortOrder,
      })),
    });
  } catch (error) {
    console.error(error);
    return jsonError("Impossible de rejoindre la session.", 500);
  }
}
