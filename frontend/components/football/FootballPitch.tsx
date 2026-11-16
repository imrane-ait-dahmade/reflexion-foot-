import { cn } from "@/lib/cn";

type FootballPitchProps = {
  children?: React.ReactNode;
  className?: string;
  /** Aspect ratio viewBox — full pitch proportions. */
  width?: number;
  height?: number;
  /** Accessible label for the pitch graphic. */
  label?: string;
};

/**
 * Lightweight responsive pitch canvas (SVG).
 * Data-driven overlays (markers, zones, heat) render as children.
 * Does not invent player data — parent supplies content.
 */
export function FootballPitch({
  children,
  className = "",
  width = 105,
  height = 68,
  label = "Terrain de football",
}: FootballPitchProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-border bg-[#0a3d2e]",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
        role="img"
        aria-label={label}
      >
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="#0a3d2e"
        />
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill="none"
          stroke="rgb(255 255 255 / 0.55)"
          strokeWidth="0.35"
        />
        <line
          x1={width / 2}
          y1="1"
          x2={width / 2}
          y2={height - 1}
          stroke="rgb(255 255 255 / 0.45)"
          strokeWidth="0.3"
        />
        <circle
          cx={width / 2}
          cy={height / 2}
          r="9.15"
          fill="none"
          stroke="rgb(255 255 255 / 0.45)"
          strokeWidth="0.3"
        />
        <circle
          cx={width / 2}
          cy={height / 2}
          r="0.5"
          fill="rgb(255 255 255 / 0.7)"
        />
        {/* Penalty boxes */}
        <rect
          x="1"
          y={(height - 40.32) / 2}
          width="16.5"
          height="40.32"
          fill="none"
          stroke="rgb(255 255 255 / 0.4)"
          strokeWidth="0.28"
        />
        <rect
          x={width - 17.5}
          y={(height - 40.32) / 2}
          width="16.5"
          height="40.32"
          fill="none"
          stroke="rgb(255 255 255 / 0.4)"
          strokeWidth="0.28"
        />
        {children}
      </svg>
    </div>
  );
}
