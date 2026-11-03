type CountdownOverlayProps = {
  count: number | null;
  onCancel?: () => void;
};

export function CountdownOverlay({ count, onCancel }: CountdownOverlayProps) {
  if (count === null) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/80">
      <p className="text-sm uppercase tracking-widest text-muted">Prépare-toi</p>
      <p className="text-7xl font-bold tabular-nums text-brand">
        {count === 0 ? "GO" : count}
      </p>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          Annuler
        </button>
      ) : null}
    </div>
  );
}
