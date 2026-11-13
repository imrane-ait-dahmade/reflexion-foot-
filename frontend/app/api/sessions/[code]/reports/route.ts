import { jsonError, jsonOk } from "@/lib/api/http";
import { analysisEnabled } from "@/lib/ai-analysis/config";
import { listGroupReport } from "@/lib/ai-analysis/analysis-repository";
import { allowManualRetry } from "@/lib/ai-analysis/permissions";
import { runAnalysisForGroup } from "@/lib/ai-analysis/run-analysis";
import { requireCoach } from "@/lib/auth-server";
import { getSessionByCode } from "@/lib/sessions/service";

export const maxDuration = 60;

type Params = { params: Promise<{ code: string }> };

async function authorizedSession(code: string) {
  const coachAuth = await requireCoach();
  if (!coachAuth) return { error: jsonError("Connexion entraîneur requise.", 401) };
  const session = await getSessionByCode(code);
  if (!session || session.session.coachId !== coachAuth.coach.id) {
    return { error: jsonError("Session introuvable.", 404) };
  }
  return { coachAuth, session };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const access = await authorizedSession(code);
    if ("error" in access) return access.error;
    const data = await listGroupReport(
      access.session.session.id,
      access.coachAuth.coach.id,
    );
    if (!data) return jsonError("Session introuvable.", 404);
    return jsonOk({
      enabled: analysisEnabled(),
      sessionTitle: data.session.title,
      sessionDate: data.session.startsAt,
      report: data.report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ai_reports")) {
      return jsonOk({
        enabled: false,
        unavailable: true,
        sessionTitle: "",
        sessionDate: null,
        report: null,
      });
    }
    console.error("ai-group-report", message || "failed");
    return jsonError("Impossible de charger le rapport de groupe.", 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const access = await authorizedSession(code);
    if ("error" in access) return access.error;
    if (!analysisEnabled()) {
      return jsonError("L'analyse IA est désactivée.", 409);
    }
    const body = (await request.json().catch(() => ({}))) as {
      reportType?: string;
    };
    if (body.reportType && body.reportType !== "group") {
      return jsonError("Ce point d'entrée génère uniquement le rapport de groupe.");
    }
    if (!allowManualRetry(`${access.coachAuth.coach.id}:${access.session.session.id}:group`)) {
      return jsonError("Réessaie dans quelques secondes.", 429);
    }
    const outcome = await runAnalysisForGroup(access.session.session.id, {
      retry: true,
    });
    if (outcome.skipped === "incomplete") {
      return jsonError(
        "Le rapport de groupe attend qu'au moins un joueur ait terminé tous ses exercices.",
        409,
      );
    }
    if (outcome.skipped === "missing_session") {
      return jsonError("Session introuvable.", 404);
    }
    if (outcome.skipped === "disabled") {
      return jsonError("L'analyse IA est désactivée.", 409);
    }
    return jsonOk({ outcome });
  } catch (error) {
    console.error("ai-group-report", error instanceof Error ? error.message : "failed");
    return jsonError("Impossible de générer le rapport de groupe.", 500);
  }
}
