"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Users } from "lucide-react";
import { textDirection } from "@/lib/ai-analysis/permissions";
import {
  friendlyApiError,
  friendlyReportError,
} from "@/lib/ai-analysis/report-errors";
import type { ReportContent, StoredReport } from "@/lib/ai-analysis/types";
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
    readyHint: (done: number, total: number) =>
      `${done}/${total} لاعب أنهى — جاهز لتقرير المجموعة.`,
  },
} as const;

function isReport(data: StoredReport["reportData"]): data is ReportContent {
  return Boolean(data && "fr" in data && "ar" in data);
}

export function CoachGroupReportPanel({
  code,
  sessionTitle,
  finishedCount,
  playerCount,
}: {
  code: string;
  sessionTitle: string;
  finishedCount: number;
  playerCount: number;
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

  const load = useCallback(async () => {
    const response = await fetch(`/api/sessions/${code}/reports`);
    const json = await response.json();
    if (!response.ok) {
      throw new Error(friendlyApiError(json.error ?? "", language));
    }
    setData(json);
    return json as GroupResponse;
  }, [code, language]);

  useEffect(() => {
    startTransition(async () => {
      try {
        await load();
      } catch (err) {
        setError(
          friendlyApiError(err instanceof Error ? err.message : "", language),
        );
      }
    });
  }, [language, load]);

  const generate = async () => {
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/sessions/${code}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: "group" }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(friendlyApiError(json.error ?? "", language));
        return;
      }
      const next = await load();
      const report = next.report;
      if (report?.status === "completed") setModalOpen(true);
      if (report?.status === "failed") {
        setError(friendlyReportError(report.errorCode, language));
      }
      if (report?.status === "not_eligible") {
        const reason =
          report.reportData && "reason" in report.reportData
            ? report.reportData.reason
            : null;
        setError(friendlyReportError("not_eligible", language, reason));
      }
    } catch (err) {
      setError(
        friendlyApiError(err instanceof Error ? err.message : "", language),
      );
    } finally {
      setBusy(false);
    }
  };

  const report = data?.report ?? null;
  const reportContent =
    report?.status === "completed" && isReport(report.reportData)
      ? report.reportData
      : null;

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
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1 text-sm"
            onClick={() => setLanguage("fr")}
          >
            Français
          </button>
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1 text-sm"
            onClick={() => setLanguage("ar")}
          >
            العربية
          </button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {!data ? <p className="text-sm text-muted">{copy.loading}</p> : null}
      {data && !data.enabled ? (
        <p className="text-sm text-muted">{copy.off}</p>
      ) : null}
      {data?.enabled ? (
        <p className="mb-2 text-sm text-muted">{copy.basis}</p>
      ) : null}
      {data?.enabled && canGenerate ? (
        <p className="mb-3 text-sm text-muted">
          {copy.readyHint(finishedCount, playerCount)}
        </p>
      ) : null}
      {data?.enabled && !canGenerate ? (
        <p className="mb-3 text-sm text-muted">{copy.waiting}</p>
      ) : null}

      {data?.enabled && canGenerate && report?.status !== "completed" ? (
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
        {busy ? <AnalysisWait key="group-wait" label={copy.pending} /> : null}
      </AnimatePresence>

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

      {reportContent ? (
        <ReportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={copy.reportTitle}
          subtitle={sessionTitle}
          direction={direction}
        >
          <ReportBody content={reportContent[language]} labels={copy} />
        </ReportModal>
      ) : null}
    </motion.section>
  );
}
