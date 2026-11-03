import { jsonError, jsonOk } from "@/lib/api/http";
import { getSessionByCode } from "@/lib/sessions/service";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const found = await getSessionByCode(code);
    if (!found) {
      return jsonError("Session introuvable.", 404);
    }

    return jsonOk({
      id: found.session.id,
      code: found.session.code,
      title: found.session.title,
      status: found.session.status,
      exercises: found.exercises.map((exercise) => ({
        testSlug: exercise.testSlug,
        sortOrder: exercise.sortOrder,
      })),
    });
  } catch (error) {
    console.error(error);
    return jsonError("Impossible de charger la session.", 500);
  }
}
