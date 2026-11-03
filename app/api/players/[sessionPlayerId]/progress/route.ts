import { jsonError, jsonOk } from "@/lib/api/http";
import { getPlayerProgress } from "@/lib/sessions/service";

type Params = { params: Promise<{ sessionPlayerId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { sessionPlayerId } = await params;
    const progress = await getPlayerProgress(sessionPlayerId);
    if (!progress) {
      return jsonError("Joueur introuvable.", 404);
    }
    return jsonOk(progress);
  } catch (error) {
    console.error(error);
    return jsonError("Impossible de charger la progression.", 500);
  }
}
