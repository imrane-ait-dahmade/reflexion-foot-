import { jsonError, jsonOk } from "@/lib/api/http";
import { requireCoach } from "@/lib/auth-server";
import { closeSession } from "@/lib/sessions/service";

type Params = { params: Promise<{ code: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const coachAuth = await requireCoach();
    if (!coachAuth) return jsonError("Connexion entraîneur requise.", 401);

    const { code } = await params;
    const result = await closeSession(code, coachAuth.coach.id);
    if (!result.ok) return jsonError(result.error, 404);

    return jsonOk({
      code: result.session.code,
      status: result.session.status,
    });
  } catch (error) {
    console.error(error);
    return jsonError("Impossible de fermer la session.", 500);
  }
}
