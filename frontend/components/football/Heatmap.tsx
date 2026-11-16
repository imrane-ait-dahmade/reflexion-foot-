type HeatCell = {
  x: number;
  y: number;
  /** Intensity 0–1 */
  value: number;
};

type HeatmapProps = {
  cells: HeatCell[];
  cellWidth?: number;
  cellHeight?: number;
  color?: string;
};

/**
 * Lightweight grid heatmap overlay.
 * Parent supplies normalized cells — no invented metrics.
 */
export function Heatmap({
  cells,
  cellWidth = 5,
  cellHeight = 5,
  color = "var(--brand)",
}: HeatmapProps) {
  if (cells.length === 0) return null;

  return (
    <g aria-hidden>
      {cells.map((cell, index) => {
        const intensity = Math.max(0, Math.min(1, cell.value));
        if (intensity <= 0) return null;
        return (
          <rect
            key={`${cell.x}-${cell.y}-${index}`}
            x={cell.x}
            y={cell.y}
            width={cellWidth}
            height={cellHeight}
            fill={color}
            opacity={0.08 + intensity * 0.55}
            rx="0.3"
          />
        );
      })}
    </g>
  );
}
