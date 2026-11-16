"use client";

import { Users } from "lucide-react";

type PlayersHeaderProps = {
  total: number | null;
  loading?: boolean;
};

export function PlayersHeader({ total, loading }: PlayersHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(0_128_96_/_0.2),transparent_55%)]"
      />
      <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between md:p-7">
        <div className="max-w-xl space-y-2">
          <p className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">
            Effectif
          </p>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Joueurs
          </h2>
          <p className="text-sm text-muted md:text-base">
            Identités, postes et équipes — historiques de tests côté API à
            venir.
          </p>
        </div>
        <div className="inline-flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Users className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Total
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {loading ? "—" : total ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
