import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/cn";

type PlayerProgressProps = {
  completed: number;
  total: number;
  label?: string;
  className?: string;
};

export function PlayerProgress({
  completed,
  total,
  label = "Progression",
  className = "",
}: PlayerProgressProps) {
  const safeTotal = Math.max(total, 1);

  return (
    <div className={cn("w-full", className)}>
      <Progress
        value={completed}
        max={safeTotal}
        label={`${label} · ${completed}/${total}`}
        showValue={false}
      />
    </div>
  );
}
