export const formatMs = (ms: number) => (ms > 0 ? `${Math.round(ms)} ms` : "—");

export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export const formatResponseTime = (ms: number) =>
  ms > 0 ? `${(ms / 1000).toFixed(2)} s` : "—";
