import type { NumberSlot } from "@/lib/tests/sequential-visual-search/layout";

type NumberFieldProps = {
  layout: NumberSlot[];
  foundUntil: number;
  flash: number | null;
  disabled: boolean;
  onPick: (number: number) => void;
};

export function NumberField({
  layout,
  foundUntil,
  flash,
  disabled,
  onPick,
}: NumberFieldProps) {
  return (
    <div className="mx-auto w-full max-w-[440px]">
      <div className="relative aspect-square w-full overflow-hidden rounded-full border border-brand/40 bg-black">
        <div className="absolute inset-[7%] rounded-full border border-dashed border-brand/25" />
        {layout.map((slot) => {
          const found = slot.number < foundUntil;
          const wrong = flash === slot.number;
          return (
            <button
              key={slot.number}
              type="button"
              disabled={disabled || found}
              aria-label={`Nombre ${slot.number}`}
              onClick={() => onPick(slot.number)}
              className={`absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold tabular-nums transition sm:size-10 ${
                found
                  ? "bg-brand text-white"
                  : wrong
                    ? "bg-danger text-white"
                    : "border border-white/20 bg-surface text-foreground hover:border-brand"
              }`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              {slot.number}
            </button>
          );
        })}
      </div>
    </div>
  );
}
