import { jsonError, jsonOk } from "@/lib/api/http";

export const maxDuration = 60;
import { listPlayerReports } from "@/lib/ai-analysis/analysis-repository";
import { analysisEnabled } from "@/lib/ai-analysis/config";
import { allowManualRetry } from "@/lib/ai-analysis/permissions";
import { runAnalysisForPlayer } from "@/lib/ai-analysis/run-analysis";
import { requireCoach } from "@/lib/auth-server";
import { getSessionByCode } from "@/lib/sessions/service";

type Params = { params: Promise<{ code: string; sessionPlayerId: string }> };

async function authorizedPlayer(code: string, sessionPlayerId: string) {
  const coachAuth = await requireCoach();
  if (!coachAuth) return { error: jsonError("Connexion entraîneur requise.", 401) };
  const session = await getSessionByCode(code);
  if (!session || session.session.coachId !== coachAuth.coach.id) {
    return { error: jsonError("Session introuvable.", 404) };
  }
  const data = await listPlayerReports(sessionPlayerId, coachAuth.coach.id);
  if (!data || data.player.sessionId !== session.session.id) {
    return { error: jsonError("Joueur introuvable.", 404) };
  }
  return { coachAuth, data };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { code, sessionPlayerId } = await params;
    const access = await authorizedPlayer(code, sessionPlayerId);
    if ("error" in access) return access.error;
    return jsonOk({
      enabled: analysisEnabled(),
      playerName: access.data.player.displayName,
      sessionDate: access.data.player.startsAt,
      reports: access.data.reports,
      usage: access.data.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ai_reports")) {
      return jsonOk({
        enabled: false,
        unavailable: true,
        playerName: "",
        sessionDate: null,
        reports: [],
        usage: { reports: 0, failed: 0, inputTokens: 0, outputTokens: 0, models: [] },
      });
    }
    console.error("ai-analysis", message || "failed");
    return jsonError("Impossible de charger les rapports.", 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { code, sessionPlayerId } = await params;
    const access = await authorizedPlayer(code, sessionPlayerId);
    if ("error" in access) return access.error;
    if (!analysisEnabled()) {
      return jsonError("L'analyse IA est désactivée.", 409);
    }
    const body = (await request.json()) as {
      reportType?: string;
      testResultId?: string;
    };
    if (body.reportType !== "session") {
      return jsonError("Un joueur a un seul rapport, pour l'ensemble de ses exercices.");
    }
    if (!allowManualRetry(`${access.coachAuth.coach.id}:${sessionPlayerId}:session`)) {
      return jsonError("Réessaie dans quelques secondes.", 429);
    }
    const outcome = await runAnalysisForPlayer(sessionPlayerId, {
      reportType: "session",
      retry: true,
    });
    if (outcome.skipped === "incomplete") {
      return jsonError(
        "Le rapport se génère quand le joueur a terminé tous ses exercices.",
        409,
      );
    }
    return jsonOk({ outcome });
  } catch (error) {
    console.error("ai-analysis", error instanceof Error ? error.message : "failed");
    return jsonError("Impossible de relancer l'analyse.", 500);
  }
}
