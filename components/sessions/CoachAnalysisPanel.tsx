"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { textDirection } from "@/lib/ai-analysis/permissions";
import type { LocalizedReport, ReportContent, StoredReport } from "@/lib/ai-analysis/types";

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
    generate: "Générer l'analyse",
    exportPdf: "Exporter PDF",
    results: "Résultats des exercices",
    empty: "Aucune analyse pour le moment. Elle démarre seulement quand vous cliquez.",
    basis: "Base : résultats de tous les joueurs sur cet exercice, et repères d'études. Pas l'historique du même joueur.",
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
    generate: "إنشاء التحليل",
    exportPdf: "تصدير PDF",
    results: "نتائج التمارين",
    empty: "لا يوجد تحليل حالياً. يبدأ فقط عند الضغط على الزر.",
    basis: "الأساس: نتائج كل اللاعبين في هذا التمرين، مع مراجع الدراسات. ليس تاريخ اللاعب نفسه.",
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

function section(title: string, items: string[]) {
  if (items.length === 0) return "";
  return `<h2>${escapeHtml(title)}</h2><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function isReport(data: StoredReport["reportData"]): data is ReportContent {
  return Boolean(data && "fr" in data && "ar" in data);
}

export type PrintableResult = {
  id: string;
  name: string;
  score: number;
  lines: { label: string; value: string }[];
};

export function CoachAnalysisPanel({
  code,
  sessionPlayerId,
  playerName,
  sessionTitle,
  results,
}: {
  code: string;
  sessionPlayerId: string;
  playerName: string;
  sessionTitle: string;
  results: PrintableResult[];
}) {
  const [language, setLanguage] = useState<"fr" | "ar">("fr");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/sessions/${code}/players/${sessionPlayerId}/reports`,
    );
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Erreur");
    setData(json);
    return json as ReportsResponse;
  }, [code, sessionPlayerId]);

  useEffect(() => {
    startTransition(async () => {
      try {
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }, [load]);

  const generate = async (testResultId: string) => {
    setError("");
    setBusyId(testResultId);
    try {
      const response = await fetch(
        `/api/sessions/${code}/players/${sessionPlayerId}/reports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportType: "test",
            testResultId,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? "Erreur");
        return;
      }
      const next = await load();
      const created = next.reports.find(
        (report) => report.reportType === "test" && report.testResultId === testResultId,
      );
      if (created?.status === "completed") setOpenId(created.id);
      if (created?.status === "failed") {
        setError(language === "ar" ? "تعذر إنشاء التحليل." : "L'analyse n'a pas pu être créée.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  };

  const copy = SECTION_LABELS[language];
  const direction = textDirection(language);

  const exportPdf = () => {
    const reportBlocks = (data?.reports ?? [])
      .map((report) => {
        if (!isReport(report.reportData)) return "";
        const content = report.reportData[language];
        return `
          <h2>${escapeHtml(report.reportType)}</h2>
          <p>${escapeHtml(content.executive_summary)}</p>
          ${section(copy.assessed, [content.what_was_assessed])}
          ${section(copy.observations, content.performance_observations.map((item) => `${item.title} — ${item.explanation}`))}
          ${section(copy.strengths, content.strengths.map((item) => `${item.title} — ${item.explanation}`))}
          ${section(copy.development, content.development_areas.map((item) => `${item.title} — ${item.explanation}`))}
          ${section(copy.training, content.training_recommendations.map((item) => `${item.title} — ${item.practical_exercise}`))}
          ${section(copy.plan, content.coach_action_plan)}
          ${section(copy.limits, content.limitations)}
        `;
      })
      .join("");
    const resultBlocks = results
      .map(
        (result) => `
          <h3>${escapeHtml(result.name)} — ${result.score}/100</h3>
          <ul>${result.lines.map((line) => `<li>${escapeHtml(line.label)} : ${escapeHtml(line.value)}</li>`).join("")}</ul>
        `,
      )
      .join("");
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return;
    popup.document.write(`<!doctype html><html lang="${language}" dir="${direction}"><head><meta charset="utf-8"><title>${escapeHtml(playerName)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; margin: 32px; line-height: 1.45; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin-top: 28px; border-top: 1px solid #ccc; padding-top: 12px; }
        h3 { font-size: 14px; margin-bottom: 4px; }
        p, li { font-size: 13px; }
        .meta { color: #444; margin-bottom: 24px; }
      </style></head><body>
      <h1>RealScouting Academy</h1>
      <p class="meta">${escapeHtml(playerName)} · ${escapeHtml(sessionTitle)}</p>
      <h2>${escapeHtml(copy.results)}</h2>
      ${resultBlocks || `<p>${escapeHtml(copy.empty)}</p>`}
      ${reportBlocks}
      </body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-3" dir={direction}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Analyse entraîneur</h3>
        <div className="flex gap-2">
          <button type="button" className="rounded-full border border-border px-3 py-1 text-sm" onClick={() => setLanguage("fr")}>
            Français
          </button>
          <button type="button" className="rounded-full border border-border px-3 py-1 text-sm" onClick={() => setLanguage("ar")}>
            العربية
          </button>
          <button type="button" className="rounded-full border border-brand px-3 py-1 text-sm text-brand" onClick={exportPdf}>
            {copy.exportPdf}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!data ? <p className="text-sm text-muted">{copy.loading}</p> : null}
      {data && !data.enabled ? <p className="text-sm text-muted">{copy.off}</p> : null}
      {data?.enabled ? <p className="mb-3 text-sm text-muted">{copy.basis}</p> : null}
      {data?.enabled ? (
        <ul className="mb-3 flex flex-col gap-2">
          {results.map((result) => {
            const existing = data.reports.find(
              (report) => report.reportType === "test" && report.testResultId === result.id,
            );
            const ready = existing?.status === "completed";
            return (
              <li key={result.id} className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">{result.name}</p>
                {ready ? null : (
                  <button
                    type="button"
                    className="rounded-full bg-brand px-3 py-1 text-sm font-semibold text-black disabled:opacity-60"
                    disabled={busyId !== null}
                    onClick={() => generate(result.id)}
                  >
                    {busyId === result.id ? copy.pending : existing?.status === "failed" ? copy.retry : copy.generate}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      <AnimatePresence>
        {busyId ? <AnalysisWait key="analysis-wait" label={copy.pending} /> : null}
      </AnimatePresence>
      {data && data.reports.every((report) => report.reportType !== "test") && !busyId ? (
        <p className="text-sm text-muted">{copy.empty}</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {data?.reports.filter((report) => report.reportType === "test").map((report) => {
          const content = isReport(report.reportData) ? report.reportData[language] : null;
          const reason =
            report.reportData && "reason" in report.reportData
              ? report.reportData.reason
              : null;
          return (
            <li key={report.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {report.reportType} · {report.status}
                </p>
                <p className="text-xs text-muted">
                  {data?.playerName} · {data?.sessionDate ? new Date(data.sessionDate).toLocaleDateString(language === "ar" ? "ar" : "fr-FR") : ""}
                </p>
              </div>
              {content ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <p className="mt-2 text-sm">{content.executive_summary}</p>
                  <button type="button" className="mt-2 text-sm text-brand" onClick={() => setOpenId(openId === report.id ? null : report.id)}>
                    {openId === report.id ? "—" : copy.summary}
                  </button>
                  {openId === report.id ? <ReportBody content={content} labels={copy} /> : null}
                </motion.div>
              ) : (
                <p className="mt-2 text-sm text-muted">{reason ?? report.errorCode ?? copy.pending}</p>
              )}
            </li>
          );
        })}
      </ul>
      {data && data.usage.reports > 0 ? (
        <p className="mt-3 text-xs text-muted">
          {data.usage.reports} rapports · {data.usage.failed} échecs · {data.usage.inputTokens}/{data.usage.outputTokens} jetons · {data.usage.models.join(", ")}
        </p>
      ) : null}
    </section>
  );
}

function AnalysisWait({ label }: { label: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mb-3 flex items-center gap-3 rounded-lg border border-brand/40 bg-brand-soft px-3 py-3"
    >
      <span className="relative flex size-8 shrink-0 items-center justify-center" aria-hidden>
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="absolute size-8 rounded-full border border-brand"
            animate={reduce ? { opacity: 0.45 } : { scale: [0.45, 1], opacity: [0.75, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.32, ease: "easeOut" }}
          />
        ))}
        <motion.span
          className="size-2.5 rounded-full bg-brand"
          animate={reduce ? undefined : { scale: [1, 1.3, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      </span>
      <p className="text-sm">{label}</p>
    </motion.div>
  );
}

function ReportBody({
  content,
  labels,
}: {
  content: LocalizedReport;
  labels: { [key in keyof (typeof SECTION_LABELS)["fr"]]: string };
}) {
  return (
    <div className="mt-3 flex flex-col gap-3 text-sm">
      <Block title={labels.assessed} text={content.what_was_assessed} />
      <ListBlock title={labels.observations} items={content.performance_observations.map((item) => item.title + " — " + item.explanation)} />
      <ListBlock title={labels.strengths} items={content.strengths.map((item) => item.title + " — " + item.explanation)} />
      <ListBlock title={labels.development} items={content.development_areas.map((item) => item.title + " — " + item.explanation)} />
      <ListBlock title={labels.training} items={content.training_recommendations.map((item) => item.title + " — " + item.practical_exercise)} />
      <ListBlock title={labels.plan} items={content.coach_action_plan} />
      <ListBlock title={labels.limits} items={content.limitations} />
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <p className="text-muted">{text}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="list-disc ps-5 text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
