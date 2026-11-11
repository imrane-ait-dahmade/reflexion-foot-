export type ChartBar = {
  label: string;
  value: number;
  /** Optional secondary label under the value, e.g. "82 %" */
  detail?: string;
};

export function clampChartValue(value: number, max = 100) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, value));
}

/** Simple SVG bar chart that prints cleanly in PDF and UI. */
export function chartSvg(
  bars: ChartBar[],
  options?: { title?: string; max?: number; width?: number; height?: number },
) {
  if (bars.length === 0) return "";
  const max = options?.max ?? Math.max(100, ...bars.map((bar) => bar.value), 1);
  const width = options?.width ?? 560;
  const height = options?.height ?? Math.max(160, 48 + bars.length * 36);
  const left = 130;
  const right = 48;
  const top = options?.title ? 36 : 16;
  const bottom = 16;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const row = plotHeight / bars.length;

  const title = options?.title
    ? `<text x="${width / 2}" y="22" text-anchor="middle" fill="#111" font-size="13" font-weight="700" font-family="Arial, sans-serif">${escapeXml(options.title)}</text>`
    : "";

  const rows = bars
    .map((bar, index) => {
      const y = top + index * row + row * 0.2;
      const barHeight = row * 0.55;
      const value = clampChartValue(bar.value, max);
      const barWidth = Math.max(2, (value / max) * plotWidth);
      const detail = bar.detail ? ` (${escapeXml(bar.detail)})` : "";
      return `
        <text x="${left - 10}" y="${y + barHeight * 0.72}" text-anchor="end" fill="#333" font-size="11" font-family="Arial, sans-serif">${escapeXml(truncate(bar.label, 18))}</text>
        <rect x="${left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="#008060"/>
        <text x="${left + barWidth + 8}" y="${y + barHeight * 0.72}" fill="#111" font-size="11" font-weight="600" font-family="Arial, sans-serif">${Math.round(value)}${detail}</text>
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${title}${rows}</svg>`;
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
