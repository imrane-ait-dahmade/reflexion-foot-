import { jsonError, jsonOk } from "@/lib/api/http";
import { requireCoach } from "@/lib/auth-server";
import type { TestSlug } from "@/lib/db/types";
import { isTestSlug } from "@/lib/sessions/exercises";
import {
  createActiveSession,
  listCoachSessions,
} from "@/lib/sessions/service";

export async function GET() {
  try {
    const coachAuth = await requireCoach();
    if (!coachAuth) return jsonError("Connexion entraîneur requise.", 401);

    const sessions = await listCoachSessions(coachAuth.coach.id);
    return jsonOk({ sessions });
  } catch (error) {
    console.error(error);
    return jsonError("Impossible de charger les sessions.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const coachAuth = await requireCoach();
    if (!coachAuth) return jsonError("Connexion entraîneur requise.", 401);

    const body = (await request.json()) as {
      title?: string;
      exerciseCount?: number;
      testSlugs?: string[];
    };

    const title = body.title?.trim();
    if (!title || title.length < 2) {
      return jsonError("Le titre de la session est requis.");
    }

    const testSlugs = body.testSlugs?.filter(isTestSlug) as
      | TestSlug[]
      | undefined;

    const created = await createActiveSession({
      coachId: coachAuth.coach.id,
      title,
      exerciseCount: body.exerciseCount,
      testSlugs,
    });

    return jsonOk(
      {
        id: created.session.id,
        code: created.session.code,
        title: created.session.title,
        status: created.session.status,
        endsAt: created.session.endsAt,
        exercises: created.exercises,
      },
      201,
    );
  } catch (error) {
    console.error(error);
    return jsonError("Impossible de créer la session.", 500);
  }
}
