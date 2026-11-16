"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  formatPositions,
  playerFullName,
  playerInitials,
  type PlayerTeamMap,
  teamsForPlayer,
} from "@/components/coach/players/player-utils";
import type { PlayerResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";

type PlayerCardProps = {
  player: PlayerResponse;
  teamMap: PlayerTeamMap;
};

export function PlayerCard({ player, teamMap }: PlayerCardProps) {
  const teams = teamsForPlayer(teamMap, player.id);
  const name = playerFullName(player);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <Link
        href={`/coach/players/${player.id}`}
        className="flex min-h-[7.5rem] flex-1 flex-col gap-3 p-4 transition hover:bg-surface-hover active:bg-surface-hover"
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-bold tracking-wide"
            aria-hidden
          >
            {playerInitials(player)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-semibold">{name}</h3>
              <Badge tone={player.is_active ? "brand" : "neutral"}>
                {player.is_active ? "Actif" : "Archivé"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-brand">{formatPositions(player)}</p>
            {player.email ? (
              <p className="mt-1 truncate text-xs text-muted">{player.email}</p>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted">Club</dt>
            <dd className="mt-0.5 font-medium text-muted/80">Non supporté</dd>
          </div>
          <div>
            <dt className="text-muted">Catégorie</dt>
            <dd className="mt-0.5 font-medium text-muted/80">Non supporté</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted">Équipes</dt>
            <dd className="mt-0.5 font-medium">
              {teams.length > 0 ? teams.join(" · ") : "—"}
            </dd>
          </div>
        </dl>
      </Link>
      <div className="flex border-t border-border">
        <Link
          href={`/coach/players/${player.id}`}
          className={cn(
            "inline-flex min-h-12 flex-1 items-center justify-center gap-2 text-sm font-semibold text-brand",
          )}
        >
          Profil
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
