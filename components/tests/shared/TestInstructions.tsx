type TestInstructionsProps = {
  steps: string[];
  tip?: string;
};

export function TestInstructions({ steps, tip }: TestInstructionsProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
      <p className="mb-2 font-semibold text-foreground">Comment jouer</p>
      <ul className="list-disc space-y-1.5 pl-5">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
      {tip ? (
        <p className="mt-3 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-xs text-brand">
          {tip}
        </p>
      ) : null}
    </div>
  );
}
