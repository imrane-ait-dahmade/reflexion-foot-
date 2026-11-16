"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
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

type ReportsResponse = {
  enabled: boolean;
  unavailable?: boolean;
  playerName: string;
  sessionDate: string | null;
  reports: StoredReport[];
  usage: {
    reports: number;
    failed: number;
    inputTokens: number;
    outputTokens: number;
    models: string[];
  };
};

const SECTION_LABELS = {
  fr: {
    summary: "Résumé",
    assessed: "Ce qui a été évalué",
    observations: "Observations",
    strengths: "Points d'appui",
    development: "Axes de travail",
    training: "Recommandations",
    plan: "Plan pour l'entraîneur",
    limits: "Limites des données",
    retry: "Relancer",
    generate: "Générer le rapport joueur",
    reportTitle: "Rapport du joueur",
    openReport: "Ouvrir le rapport",
    exportPdf: "Télécharger PDF",
    results: "Résultats des exercices",
    chartTitle: "Précision par exercice",
    generatedBy: "Généré par RealScouting Academy",
    empty: "Un rapport pour ce joueur, quand il a terminé tous ses exercices.",
    waiting: "Le joueur n'a pas encore terminé tous ses exercices.",
    basis: "Rapport individuel : tous les exercices de ce joueur.",
    off: "L'analyse IA est désactivée.",
    loading: "Chargement…",
    pending: "Analyse en cours. Merci de patienter.",
  },
  ar: {
    summary: "الملخص",
    assessed: "ما تم تقييمه",
    observations: "الملاحظات",
    strengths: "نقاط القوة",
    development: "محاور التطوير",
    training: "التوصيات",
    plan: "خطة المدرب",
    limits: "حدود المعطيات",
    retry: "إعادة المحاولة",
    generate: "إنشاء تقرير اللاعب",
    reportTitle: "تقرير اللاعب",
    openReport: "فتح التقرير",
    exportPdf: "تحميل PDF",
    results: "نتائج التمارين",
    chartTitle: "الدقة حسب التمرين",
    generatedBy: "من إعداد RealScouting Academy",
    empty: "تقرير واحد لهذا اللاعب بعد إنهاء كل التمارين.",
    waiting: "لم يُنهِ اللاعب كل التمارين بعد.",
    basis: "تقرير فردي: كل تمارين هذا اللاعب.",
    off: "تحليل الذكاء الاصطناعي متوقف.",
    loading: "جارٍ التحميل…",
    pending: "التحليل قيد الإنجاز. يرجى الانتظار.",
  },
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

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

export type PrintableResult = {
  id: string;
  name: string;
  headline: string;
  note: string;
  score: number;
  accuracy: number;
  lines: { label: string; value: string }[];
};

export function CoachAnalysisPanel({
  trainingSessionId,
  sessionPlayerId,
  playerName,
  sessionTitle,
  exerciseCount,
  results,
}: {
  /** FastAPI V2 session UUID. */
  trainingSessionId: string;
  sessionPlayerId: string;
  playerName: string;
  sessionTitle: string;
  exerciseCount: number;
  results: PrintableResult[];
}) {
  const [language, setLanguage] = useState<"fr" | "ar">("fr");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    const list = await reportsService.listForSession(trainingSessionId);
    const playerReports = list.items
      .filter((item) => item.session_player_id === sessionPlayerId)
      .map(mapV2Report);
    const usage = playerReports.reduce(
      (acc, report) => {
        acc.inputTokens += report.inputTokens;
        acc.outputTokens += report.outputTokens;
        if (report.model) acc.models.add(report.model);
        return acc;
      },
      { inputTokens: 0, outputTokens: 0, models: new Set<string>() },
    );
    const json: ReportsResponse = {
      enabled: true,
      playerName,
      sessionDate: null,
      reports: playerReports,
      usage: {
        reports: playerReports.length,
        failed: playerReports.filter((r) => r.status === "failed").length,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        models: [...usage.models],
      },
    };
    setData(json);
    return json;
  }, [playerName, sessionPlayerId, trainingSessionId]);

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
        report_type: "session",
        session_player_id: sessionPlayerId,
        training_session_id: trainingSessionId,
        force: false,
      });
      const next = await load();
      const created =
        next.reports.find((report) => report.id === createdRow.id) ??
        mapV2Report(createdRow);
      if (created.status === "completed") setModalOpen(true);
      if (created.status === "not_eligible") {
        const reason =
          created.reportData && "reason" in created.reportData
            ? created.reportData.reason
            : null;
        setError(friendlyReportError("not_eligible", language, reason));
      }
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        const next = await load();
        const existing = next.reports.find((r) => r.reportType === "session");
        if (existing?.status === "completed") setModalOpen(true);
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

  const copy = SECTION_LABELS[language];
  const direction = textDirection(language);
  const report = data?.reports.find((item) => item.reportType === "session") ?? null;
  const finished = exerciseCount > 0 && results.length >= exerciseCount;
  const reportContent =
    report?.status === "completed" && isReport(report.reportData)
      ? report.reportData
      : null;

  // Accuracy is comparable across exercises; raw score scales differ (e.g. digit memory).
  const chartBars: ChartBar[] = results.map((result) => ({
    label: result.name,
    value: result.accuracy,
    detail: `s${Math.round(result.score)}`,
  }));

  const exportPdf = () => {
    if (!reportContent) return;
    const resultBlocks = results
      .map(
        (result) => `
          <h3>${escapeHtml(result.name)} — ${escapeHtml(result.headline)}</h3>
          <p>${escapeHtml(result.note)}</p>
          <ul>${result.lines.map((line) => `<li>${escapeHtml(line.label)} : ${escapeHtml(line.value)}</li>`).join("")}</ul>
        `,
      )
      .join("");
    openReportPdf(
      buildReportPdfHtml({
        language,
        direction,
        title: `${copy.reportTitle} · ${playerName}`,
        subtitle: `${playerName} · ${sessionTitle}`,
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
          results: copy.results,
          chartTitle: copy.chartTitle,
          generatedBy: copy.generatedBy,
        },
        chartBars,
        resultHtml: resultBlocks || undefined,
      }),
    );
  };

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-3" dir={direction}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-brand" aria-hidden />
          Rapport joueur
        </h3>
        <div className="flex gap-2">
          <button type="button" className="rounded-full border border-border px-3 py-1 text-sm" onClick={() => setLanguage("fr")}>
            Français
          </button>
          <button type="button" className="rounded-full border border-border px-3 py-1 text-sm" onClick={() => setLanguage("ar")}>
            العربية
          </button>
          <button
            type="button"
            className="rounded-full border border-brand px-3 py-1 text-sm text-brand disabled:opacity-50"
            onClick={exportPdf}
            disabled={!reportContent}
          >
            {copy.exportPdf}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!data ? <p className="text-sm text-muted">{copy.loading}</p> : null}
      {data && !data.enabled ? <p className="text-sm text-muted">{copy.off}</p> : null}
      {data?.enabled ? <p className="mb-3 text-sm text-muted">{copy.basis}</p> : null}
      {data?.enabled && !finished ? (
        <p className="mb-3 text-sm text-muted">{copy.waiting}</p>
      ) : null}

      {data?.enabled && finished && report?.status !== "completed" ? (
        <motion.button
          type="button"
          className="mb-3 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          disabled={busy}
          onClick={generate}
          whileTap={{ scale: 0.98 }}
        >
          {busy
            ? copy.pending
            : report?.status === "failed" || report?.status === "not_eligible"
              ? copy.retry
              : copy.generate}
        </motion.button>
      ) : null}

      <AnimatePresence>
        {busy ? <AnalysisWait key="analysis-wait" label={copy.pending} /> : null}
      </AnimatePresence>

      {data?.enabled && finished && !report && !busy ? (
        <p className="text-sm text-muted">{copy.empty}</p>
      ) : null}

      {reportContent ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-brand/30 bg-brand-soft/40 p-3"
        >
          <p className="font-semibold">{copy.reportTitle}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted">
            {reportContent[language].executive_summary}
          </p>
          <button
            type="button"
            className="mt-3 inline-flex min-h-10 items-center rounded-full border border-brand px-4 text-sm font-semibold text-brand"
            onClick={() => setModalOpen(true)}
          >
            {copy.openReport}
          </button>
        </motion.div>
      ) : null}

      {report &&
      (report.status === "failed" || report.status === "not_eligible") &&
      !busy &&
      !error ? (
        <p role="alert" className="rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger">
          {friendlyReportError(
            report.status === "not_eligible" ? "not_eligible" : report.errorCode,
            language,
            report.reportData && "reason" in report.reportData
              ? report.reportData.reason
              : null,
          )}
        </p>
      ) : null}

      {report &&
      (report.status === "pending" || report.status === "processing") &&
      !busy ? (
        <p className="text-sm text-muted">{copy.pending}</p>
      ) : null}

      {reportContent ? (
        <ReportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={copy.reportTitle}
          subtitle={`${playerName} · ${sessionTitle}`}
          direction={direction}
        >
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand"
              onClick={exportPdf}
            >
              {copy.exportPdf}
            </button>
          </div>
          <ReportBody
            content={reportContent[language]}
            labels={copy}
            chart={
              <ReportBarChart title={copy.chartTitle} bars={chartBars} />
            }
          />
        </ReportModal>
      ) : null}
    </section>
  );
}
