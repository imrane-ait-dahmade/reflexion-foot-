import { jsonError, jsonOk } from "@/lib/api/http";
import { requireCoach } from "@/lib/auth-server";
import { archiveSession, getSessionByCode } from "@/lib/sessions/service";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const found = await getSessionByCode(code);
    if (!found || found.session.archivedAt) {
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

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const coachAuth = await requireCoach();
    if (!coachAuth) return jsonError("Connexion entraîneur requise.", 401);

    const { code } = await params;
    const result = await archiveSession(code, coachAuth.coach.id);
    if (!result.ok) return jsonError(result.error, 404);

    return jsonOk({ code: result.session.code, archived: true });
  } catch (error) {
    console.error(error);
    return jsonError("Impossible de retirer la session.", 500);
  }
}
