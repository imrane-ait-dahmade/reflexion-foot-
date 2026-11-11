import { chartSvg, type ChartBar } from "./report-charts";
import type { LocalizedReport } from "./types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sectionList(title: string, items: string[]) {
  if (items.length === 0) return "";
  return `
    <section class="block">
      <h2>${escapeHtml(title)}</h2>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}

export type ReportPdfLabels = {
  reportTitle: string;
  assessed: string;
  observations: string;
  strengths: string;
  development: string;
  training: string;
  plan: string;
  limits: string;
  results?: string;
  chartTitle: string;
  generatedBy: string;
};

export type ReportPdfInput = {
  language: "fr" | "ar";
  direction: "ltr" | "rtl";
  title: string;
  subtitle: string;
  logoUrl: string;
  content: LocalizedReport;
  labels: ReportPdfLabels;
  chartBars?: ChartBar[];
  resultHtml?: string;
};

export function buildReportPdfHtml(input: ReportPdfInput) {
  const { content, labels } = input;
  const chart =
    input.chartBars && input.chartBars.length > 0
      ? `<section class="block chart">${chartSvg(input.chartBars, {
          title: labels.chartTitle,
        })}</section>`
      : "";

  return `<!doctype html>
<html lang="${input.language}" dir="${input.direction}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root { --brand: #008060; --ink: #111; --muted: #555; --line: #e5e5e5; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: #fff;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
    }
    .page { padding: 28px 32px 40px; max-width: 820px; margin: 0 auto; }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 16px;
      border-bottom: 3px solid var(--brand);
      margin-bottom: 18px;
    }
    .header img { width: 48px; height: 48px; object-fit: contain; }
    .brand-name { font-size: 18px; font-weight: 700; margin: 0; }
    .brand-sub { margin: 2px 0 0; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--brand); font-weight: 700; }
    .meta { color: var(--muted); font-size: 13px; margin: 0 0 18px; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    h2 {
      font-size: 14px;
      margin: 0 0 8px;
      color: var(--brand);
      border-bottom: 1px solid var(--line);
      padding-bottom: 6px;
    }
    h3 { font-size: 13px; margin: 0 0 4px; }
    p, li { font-size: 12.5px; }
    .summary {
      background: #f3faf7;
      border: 1px solid #cfe8df;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 18px;
    }
    .block { margin-top: 18px; }
    .chart { padding: 8px 0 4px; }
    .chart svg { width: 100%; height: auto; }
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--muted);
      font-size: 11px;
    }
    .badge {
      display: inline-block;
      border: 1px solid var(--brand);
      color: var(--brand);
      border-radius: 999px;
      padding: 4px 10px;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    @media print {
      .page { padding: 12px 16px 20px; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <img src="${escapeHtml(input.logoUrl)}" alt="RealScouting Academy" />
      <div>
        <p class="brand-name">RealScouting Academy</p>
        <p class="brand-sub">Cognitif Connexion Foot</p>
      </div>
    </header>

    <h1>${escapeHtml(labels.reportTitle)}</h1>
    <p class="meta">${escapeHtml(input.subtitle)}</p>

    <section class="summary">
      <p>${escapeHtml(content.executive_summary)}</p>
    </section>

    ${chart}

    ${input.resultHtml ? `<section class="block"><h2>${escapeHtml(labels.results ?? "Résultats")}</h2>${input.resultHtml}</section>` : ""}

    <section class="block">
      <h2>${escapeHtml(labels.assessed)}</h2>
      <p>${escapeHtml(content.what_was_assessed)}</p>
    </section>

    ${sectionList(
      labels.observations,
      content.performance_observations.map(
        (item) => `${item.title} — ${item.explanation}`,
      ),
    )}
    ${sectionList(
      labels.strengths,
      content.strengths.map((item) => `${item.title} — ${item.explanation}`),
    )}
    ${sectionList(
      labels.development,
      content.development_areas.map(
        (item) => `${item.title} — ${item.explanation}`,
      ),
    )}
    ${sectionList(
      labels.training,
      content.training_recommendations.map(
        (item) => `${item.title} — ${item.practical_exercise}`,
      ),
    )}
    ${sectionList(labels.plan, content.coach_action_plan)}
    ${sectionList(labels.limits, content.limitations)}

    <footer class="footer">
      <span class="badge">${escapeHtml(labels.generatedBy)}</span>
      <span>${escapeHtml(new Date().toLocaleString(input.language === "ar" ? "ar" : "fr-FR"))}</span>
    </footer>
  </div>
</body>
</html>`;
}

export function openReportPdf(html: string) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return false;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  // Give images (logo) a beat to load before print.
  window.setTimeout(() => {
    try {
      popup.print();
    } catch {
      // User can still print manually.
    }
  }, 250);
  return true;
}
