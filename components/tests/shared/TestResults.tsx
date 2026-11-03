import { Button } from "@/components/ui/Button";

export type ResultItem = {
  label: string;
  value: string;
};

type TestResultsProps = {
  title: string;
  score: React.ReactNode;
  items: ResultItem[];
  onRestart?: () => void;
  restartLabel?: string;
  /** In session mode, restart is hidden to avoid confusing one-shot attempts. */
  sessionMode?: boolean;
};

export function TestResults({
  title,
  score,
  items,
  onRestart,
  restartLabel = "Recommencer",
  sessionMode = false,
}: TestResultsProps) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm uppercase tracking-wide text-muted">Score total</p>
        <p className="text-5xl font-bold tabular-nums text-brand">{score}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-baseline justify-between gap-2 border-b border-border pb-1"
          >
            <dt className="text-muted">{item.label}</dt>
            <dd className="font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      {!sessionMode && onRestart ? (
        <Button onClick={onRestart}>{restartLabel}</Button>
      ) : null}

      {sessionMode ? (
        <p className="text-center text-xs text-muted">
          En session, un seul essai compte. Passe à l&apos;exercice suivant
          quand l&apos;envoi est confirmé.
        </p>
      ) : null}
    </section>
  );
}
