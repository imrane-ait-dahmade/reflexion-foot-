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
    generate: "Générer le rapport",
    reportTitle: "Rapport du joueur",
    exportPdf: "Exporter PDF",
    results: "Résultats des exercices",
    empty: "Un seul rapport par joueur. Il se crée quand le joueur a terminé tous ses exercices et que vous cliquez.",
    waiting: "Le joueur n'a pas encore terminé tous ses exercices. Le rapport unique attend la fin.",
    basis: "Un seul rapport pour ce joueur, à partir de tous ses exercices de cette séance.",
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
    generate: "إنشاء التقرير",
    reportTitle: "تقرير اللاعب",
    exportPdf: "تصدير PDF",
    results: "نتائج التمارين",
    empty: "تقرير واحد لكل لاعب. يُنشأ عندما يُنهي كل التمارين وتضغط على الزر.",
    waiting: "لم يُنهِ اللاعب كل التمارين بعد. التقرير الوحيد ينتظر النهاية.",
    basis: "تقرير واحد لهذا اللاعب، من كل تمارين هذه الحصة.",
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
  headline: string;
  note: string;
  lines: { label: string; value: string }[];
};

export function CoachAnalysisPanel({
  code,
  sessionPlayerId,
  playerName,
  sessionTitle,
  exerciseCount,
  results,
}: {
  code: string;
  sessionPlayerId: string;
  playerName: string;
  sessionTitle: string;
  exerciseCount: number;
  results: PrintableResult[];
}) {
  const [language, setLanguage] = useState<"fr" | "ar">("fr");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const generate = async () => {
    setError("");
    setBusy(true);
    try {
      const response = await fetch(
        `/api/sessions/${code}/players/${sessionPlayerId}/reports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportType: "session" }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? "Erreur");
        return;
      }
      const next = await load();
      const created = next.reports.find((report) => report.reportType === "session");
      if (created?.status === "completed") setOpen(true);
      if (created?.status === "failed") {
        setError(language === "ar" ? "تعذر إنشاء التقرير." : "Le rapport n'a pas pu être créé.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const copy = SECTION_LABELS[language];
  const direction = textDirection(language);
  const report = data?.reports.find((item) => item.reportType === "session") ?? null;
  const finished = exerciseCount > 0 && results.length >= exerciseCount;

  const exportPdf = () => {
    const reportBlocks = (report ? [report] : [])
      .map((report) => {
        if (!isReport(report.reportData)) return "";
        const content = report.reportData[language];
        return `
          <h2>${escapeHtml(copy.reportTitle)}</h2>
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
          <h3>${escapeHtml(result.name)} — ${escapeHtml(result.headline)}</h3>
          <p>${escapeHtml(result.note)}</p>
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
      {data?.enabled && !finished ? (
        <p className="mb-3 text-sm text-muted">{copy.waiting}</p>
      ) : null}
      {data?.enabled && finished && report?.status !== "completed" ? (
        <button
          type="button"
          className="mb-3 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          disabled={busy}
          onClick={generate}
        >
          {busy ? copy.pending : report?.status === "failed" ? copy.retry : copy.generate}
        </button>
      ) : null}
      <AnimatePresence>
        {busy ? <AnalysisWait key="analysis-wait" label={copy.pending} /> : null}
      </AnimatePresence>
      {data?.enabled && finished && !report && !busy ? (
        <p className="text-sm text-muted">{copy.empty}</p>
      ) : null}
      {report ? (
        <article className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{copy.reportTitle}</p>
            <p className="text-xs text-muted">
              {data?.playerName} · {data?.sessionDate ? new Date(data.sessionDate).toLocaleDateString(language === "ar" ? "ar" : "fr-FR") : ""}
            </p>
          </div>
          {isReport(report.reportData) ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <p className="mt-2 text-sm">{report.reportData[language].executive_summary}</p>
              <button type="button" className="mt-2 text-sm text-brand" onClick={() => setOpen((current) => !current)}>
                {open ? "—" : copy.summary}
              </button>
              {open ? <ReportBody content={report.reportData[language]} labels={copy} /> : null}
            </motion.div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {(report.reportData && "reason" in report.reportData
                ? report.reportData.reason
                : null) ?? report.errorCode ?? copy.pending}
            </p>
          )}
        </article>
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
