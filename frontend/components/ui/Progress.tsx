import { cn } from "@/lib/cn";

type ProgressProps = {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  showValue?: boolean;
};

export function Progress({
  value,
  max = 100,
  label,
  className = "",
  showValue = false,
}: ProgressProps) {
  const safeMax = max <= 0 ? 1 : max;
  const clamped = Math.max(0, Math.min(value, safeMax));
  const percent = Math.round((clamped / safeMax) * 100);

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          {label ? <span>{label}</span> : <span />}
          {showValue ? (
            <span className="tabular-nums text-foreground">{percent}%</span>
          ) : null}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
