type StatCardProps = {
  label: string;
  value: React.ReactNode;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-foreground/15 px-2 py-2">
      <span className="text-xs uppercase tracking-wide text-foreground/60">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}
