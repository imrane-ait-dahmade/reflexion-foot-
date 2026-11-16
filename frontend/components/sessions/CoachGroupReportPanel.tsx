"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Users } from "lucide-react";
import { textDirection } from "@/lib/ai-analysis/permissions";
import {
  friendlyApiError,
  friendlyReportError,
} from "@/lib/ai-analysis/report-errors";
import type { ChartBar } from "@/lib/ai-analysis/report-charts";
import { buildReportPdfHtml, openReportPdf } from "@/lib/ai-analysis/report-pdf";
import type { ReportContent, StoredReport } from "@/lib/ai-analysis/types";
import {
  reportsService,
  type AiReportResponse,
} from "@/lib/api/reports.service";
import { isApiError } from "@/lib/api/errors";
import { ReportBarChart } from "@/components/sessions/ReportCharts";
import {
  AnalysisWait,
  ReportBody,
  ReportModal,
} from "@/components/sessions/ReportModal";

type GroupResponse = {
  enabled: boolean;
  unavailable?: boolean;
  sessionTitle: string;
  sessionDate: string | null;
  report: StoredReport | null;
};

const LABELS = {
  fr: {
    title: "Rapport de tous les joueurs",
    basis: "Un seul rapport pour toute la séance, à partir des joueurs qui ont terminé.",
    waiting: "Attendez qu'au moins un joueur termine tous ses exercices.",
    generate: "Générer le rapport groupe",
    retry: "Relancer",
    openReport: "Ouvrir le rapport",
    exportPdf: "Télécharger PDF",
    pending: "Analyse du groupe en cours…",
    off: "L'analyse IA est désactivée.",
    loading: "Chargement…",
    reportTitle: "Rapport de séance",
    assessed: "Ce qui a été évalué",
    observations: "Observations",
    strengths: "Points d'appui",
    development: "Axes de travail",
    training: "Recommandations",
    plan: "Plan pour l'entraîneur",
    limits: "Limites des données",
    chartTitle: "Moyenne des joueurs terminés",
    generatedBy: "Généré par RealScouting Academy",
    readyHint: (done: number, total: number) =>
      `${done}/${total} joueur(s) terminé(s) — prêt pour le rapport groupe.`,
  },
  ar: {
    title: "تقرير كل اللاعبين",
    basis: "تقرير واحد للحصة كلها من اللاعبين الذين أنهوا.",
    waiting: "انتظر حتى يُنهي لاعب واحد على الأقل كل التمارين.",
    generate: "إنشاء تقرير المجموعة",
    retry: "إعادة المحاولة",
    openReport: "فتح التقرير",
    exportPdf: "تحميل PDF",
    pending: "تحليل المجموعة قيد الإنجاز…",
    off: "تحليل الذكاء الاصطناعي متوقف.",
    loading: "جارٍ التحميل…",
    reportTitle: "تقرير الحصة",
    assessed: "ما تم تقييمه",
    observations: "الملاحظات",
    strengths: "نقاط القوة",
    development: "محاور التطوير",
    training: "التوصيات",
    plan: "خطة المدرب",
    limits: "حدود المعطيات",
    chartTitle: "متوسط اللاعبين الذين أنهوا",
    generatedBy: "من إعداد RealScouting Academy",
    readyHint: (done: number, total: number) =>
      `${done}/${total} لاعب أنهى — جاهز لتقرير المجموعة.`,
  },
} as const;

function isReport(data: StoredReport["reportData"]): data is ReportContent {
  return Boolean(data && "fr" in data && "ar" in data);
}

function mapV2Report(row: AiReportResponse): StoredReport {
  const data = row.report_data ?? {};
  const statusRaw = typeof data.status === "string" ? data.status : "completed";
  const status =
    statusRaw === "abstained"
      ? "not_eligible"
      : statusRaw === "ready" || statusRaw === "completed"
        ? "completed"
        : statusRaw === "failed"
          ? "failed"
          : "completed";
  const usage =
    data.token_usage && typeof data.token_usage === "object"
      ? (data.token_usage as { input?: number; output?: number })
      : {};
  const content =
    data.fr && data.ar
      ? (data as unknown as ReportContent)
      : status === "not_eligible"
        ? { reason: String(data.confidence_reason ?? "insufficient_data") }
        : null;
  return {
    id: row.id,
    sessionId: row.training_session_id ?? "",
    sessionPlayerId: row.session_player_id,
    testResultId: null,
    reportType: row.report_type,
    status,
    reportData: content,
    model: row.model_name,
    promptVersion: row.prompt_version,
    inputTokens: usage.input ?? 0,
    outputTokens: usage.output ?? 0,
    errorCode: null,
    generatedAt: row.created_at,
  };
}

export function CoachGroupReportPanel({
  trainingSessionId,
  sessionTitle,
  finishedCount,
  playerCount,
  playerScores,
}: {
  trainingSessionId: string;
  sessionTitle: string;
  finishedCount: number;
  playerCount: number;
  playerScores: { name: string; averageScore: number }[];
}) {
  const [language, setLanguage] = useState<"fr" | "ar">("fr");
  const [data, setData] = useState<GroupResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  const copy = LABELS[language];
  const direction = textDirection(language);
  const canGenerate = finishedCount >= 1;

  const chartBars: ChartBar[] = useMemo(
    () =>
      [...playerScores]
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 12)
        .map((player) => ({
          label: player.name,
          value: player.averageScore,
        })),
    [playerScores],
  );

  const load = useCallback(async () => {
    const list = await reportsService.listForSession(trainingSessionId);
    const groupReports = list.items
      .filter(
        (item) => item.report_type === "group" && item.session_player_id == null,
      )
      .map(mapV2Report);
    const report = groupReports[0] ?? null;
    const json: GroupResponse = {
      enabled: true,
      sessionTitle,
      sessionDate: null,
      report,
    };
    setData(json);
    return json;
  }, [sessionTitle, trainingSessionId]);

  useEffect(() => {
    startTransition(async () => {
      try {
        await load();
      } catch (err) {
        const message = isApiError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : "";
        setError(friendlyApiError(message, language));
      }
    });
  }, [language, load]);

  const generate = async () => {
    setError("");
    setBusy(true);
    try {
      const createdRow = await reportsService.generate({
        report_type: "group",
        training_session_id: trainingSessionId,
        force: false,
      });
      const next = await load();
      const report = next.report ?? mapV2Report(createdRow);
      if (report.status === "completed") setModalOpen(true);
      if (report.status === "failed") {
        setError(friendlyReportError(report.errorCode, language));
      }
      if (report.status === "not_eligible") {
        const reason =
          report.reportData && "reason" in report.reportData
            ? report.reportData.reason
            : null;
        setError(friendlyReportError("not_eligible", language, reason));
      }
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        const next = await load();
        if (next.report?.status === "completed") setModalOpen(true);
        return;
      }
      const message = isApiError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : "";
      setError(friendlyApiError(message, language));
    } finally {
      setBusy(false);
    }
  };

  const report = data?.report ?? null;
  const reportContent =
    report?.status === "completed" && isReport(report.reportData)
      ? report.reportData
      : null;

  const exportPdf = () => {
    if (!reportContent) return;
    openReportPdf(
      buildReportPdfHtml({
        language,
        direction,
        title: `${copy.reportTitle} · ${sessionTitle}`,
        subtitle: sessionTitle,
        logoUrl: `${window.location.origin}/logo-rs.png`,
        content: reportContent[language],
        labels: {
          reportTitle: copy.reportTitle,
          assessed: copy.assessed,
          observations: copy.observations,
          strengths: copy.strengths,
          development: copy.development,
          training: copy.training,
          plan: copy.plan,
          limits: copy.limits,
          chartTitle: copy.chartTitle,
          generatedBy: copy.generatedBy,
        },
        chartBars,
      }),
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-surface p-4"
      dir={direction}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-semibold">
          <Users className="size-4 text-brand" aria-hidden />
          {copy.title}
        </h3>
        <div className="flex gap-1">
          {(["fr", "ar"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`rounded-md px-2 py-1 text-xs uppercase ${
                language === lang
                  ? "bg-brand text-white"
                  : "bg-brand-soft text-brand"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-sm text-muted">{copy.basis}</p>
      <p className="mb-3 text-sm text-muted">
        {canGenerate
          ? copy.readyHint(finishedCount, playerCount)
          : copy.waiting}
      </p>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canGenerate || busy}
          onClick={() => void generate()}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? copy.pending : report ? copy.retry : copy.generate}
        </button>
        {reportContent ? (
          <>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              {copy.openReport}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              {copy.exportPdf}
            </button>
          </>
        ) : null}
      </div>

      {chartBars.length > 0 ? (
        <div className="mt-4">
          <ReportBarChart title={copy.chartTitle} bars={chartBars} />
        </div>
      ) : null}

      <AnimatePresence>
        {busy ? <AnalysisWait label={copy.pending} /> : null}
      </AnimatePresence>

      <ReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={copy.reportTitle}
        subtitle={sessionTitle}
        direction={direction}
      >
        {reportContent ? (
          <ReportBody
            content={reportContent[language]}
            labels={{
              assessed: copy.assessed,
              observations: copy.observations,
              strengths: copy.strengths,
              development: copy.development,
              training: copy.training,
              plan: copy.plan,
              limits: copy.limits,
            }}
            chart={<ReportBarChart title={copy.chartTitle} bars={chartBars} />}
          />
        ) : null}
      </ReportModal>
    </motion.section>
  );
}
