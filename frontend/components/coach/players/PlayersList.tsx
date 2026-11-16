"use client";

import { Plus } from "lucide-react";
import { PlayerCard } from "@/components/coach/players/PlayerCard";
import type { PlayerTeamMap } from "@/components/coach/players/player-utils";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PlayerResponse } from "@/lib/api/types";

type PlayersListProps = {
  players: PlayerResponse[];
  teamMap: PlayerTeamMap;
  loaded: boolean;
  onCreate: () => void;
};

export function PlayersList({
  players,
  teamMap,
  loaded,
  onCreate,
}: PlayersListProps) {
  if (!loaded) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-4">
        <CardHeader className="mb-0">
          <CardTitle>Aucun joueur</CardTitle>
          <CardDescription>
            Crée un joueur ou importe un fichier Excel pour constituer l’effectif.
          </CardDescription>
        </CardHeader>
        <Button onClick={onCreate} className="min-h-12">
          <Plus className="size-4" aria-hidden />
          Créer un joueur
        </Button>
      </Card>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {players.map((player) => (
        <li key={player.id}>
          <PlayerCard player={player} teamMap={teamMap} />
        </li>
      ))}
    </ul>
  );
}
