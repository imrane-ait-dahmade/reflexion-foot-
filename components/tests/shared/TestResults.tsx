import { Button } from "@/components/ui/Button";

export type ResultItem = {
  label: string;
  value: string;
};

type TestResultsProps = {
  title: string;
  score: React.ReactNode;
  items: ResultItem[];
  onRestart: () => void;
  restartLabel?: string;
};

export function TestResults({
  title,
  score,
  items,
  onRestart,
  restartLabel = "Restart Test",
}: TestResultsProps) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-foreground/15 p-5">
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm uppercase tracking-wide text-foreground/60">
          Total score
        </p>
        <p className="text-5xl font-bold tabular-nums">{score}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-baseline justify-between gap-2 border-b border-foreground/10 pb-1"
          >
            <dt className="text-foreground/70">{item.label}</dt>
            <dd className="font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <Button onClick={onRestart}>{restartLabel}</Button>
    </section>
  );
}
