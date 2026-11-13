type MemoryGridProps = {
  cellCount: number;
  columns: number;
  /** Cells shown during the memorization phase. Empty during the answer phase. */
  highlighted: number[];
  /** Correct cells already selected by the player. */
  selected: number[];
  disabled: boolean;
  wrongFlash: { index: number; id: number } | null;
  onCellPress: (index: number) => void;
};

// No CSS transitions: highlights must disappear instantly, leaving no trace.
const BASE_CELL =
  "aspect-square min-h-12 touch-manipulation select-none rounded-lg border";
const IDLE_CELL = "border-border bg-surface";
const HIGHLIGHT_CELL = "border-brand bg-brand";
const SELECTED_CELL = "border-brand bg-brand-soft text-brand";

export function MemoryGrid({
  cellCount,
  columns,
  highlighted,
  selected,
  disabled,
  wrongFlash,
  onCellPress,
}: MemoryGridProps) {
  return (
    <div
      className="mx-auto grid w-full max-w-md gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cellCount }, (_, index) => {
        const isFlashing = wrongFlash?.index === index;
        const state = highlighted.includes(index)
          ? HIGHLIGHT_CELL
          : selected.includes(index)
            ? SELECTED_CELL
            : IDLE_CELL;

        return (
          <button
            // Re-keying restarts the error animation on repeated wrong clicks.
            key={isFlashing ? `${index}-${wrongFlash.id}` : index}
            type="button"
            aria-label={`Case ${index + 1}`}
            disabled={disabled}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              onCellPress(index);
            }}
            onClick={(event) => {
              // detail === 0 means keyboard activation (Enter / Space).
              if (event.detail === 0) onCellPress(index);
            }}
            className={`${BASE_CELL} ${state} ${isFlashing ? "animate-wrong-flash" : ""}`}
          />
        );
      })}
    </div>
  );
}
