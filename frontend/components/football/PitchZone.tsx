type PitchZoneProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  tone?: "brand" | "warning" | "danger" | "info" | "neutral";
  opacity?: number;
};

const TONE_FILL: Record<NonNullable<PitchZoneProps["tone"]>, string> = {
  brand: "var(--brand)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "#ffffff",
};

/** Rectangular highlight zone in pitch coordinates. */
export function PitchZone({
  x,
  y,
  width,
  height,
  label,
  tone = "brand",
  opacity = 0.22,
}: PitchZoneProps) {
  return (
    <g aria-label={label}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={TONE_FILL[tone]}
        opacity={opacity}
        rx="0.4"
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={TONE_FILL[tone]}
        strokeWidth="0.25"
        opacity="0.55"
        rx="0.4"
      />
    </g>
  );
}
