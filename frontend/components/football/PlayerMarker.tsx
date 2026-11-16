import { cn } from "@/lib/cn";

type PlayerMarkerProps = {
  x: number;
  y: number;
  label?: string;
  tone?: "home" | "away" | "focus" | "neutral";
  selected?: boolean;
  r?: number;
  className?: string;
};

const TONE_FILL: Record<NonNullable<PlayerMarkerProps["tone"]>, string> = {
  home: "var(--brand)",
  away: "#f97316",
  focus: "#fbbf24",
  neutral: "#e5e5e5",
};

/** Point marker in pitch coordinates (same units as FootballPitch viewBox). */
export function PlayerMarker({
  x,
  y,
  label,
  tone = "neutral",
  selected = false,
  r = 1.6,
  className = "",
}: PlayerMarkerProps) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={cn(className)}
      aria-label={label}
    >
      {selected ? (
        <circle
          r={r + 0.9}
          fill="none"
          stroke="white"
          strokeWidth="0.35"
          opacity="0.9"
        />
      ) : null}
      <circle
        r={r}
        fill={TONE_FILL[tone]}
        stroke="rgb(0 0 0 / 0.35)"
        strokeWidth="0.25"
      />
      {label ? (
        <text
          y={r + 2.2}
          textAnchor="middle"
          fill="white"
          fontSize="2.2"
          fontFamily="var(--font-geist-sans), sans-serif"
          opacity="0.9"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
