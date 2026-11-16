"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { PositionResponse, TeamResponse } from "@/lib/api/types";

export type PlayerFilterState = {
  teamId: string;
  positionId: string;
  status: "active" | "inactive" | "all";
};

type PlayerFiltersProps = {
  value: PlayerFilterState;
  onChange: (next: PlayerFilterState) => void;
  teams: TeamResponse[];
  positions: PositionResponse[];
  disabled?: boolean;
};

export function PlayerFilters({
  value,
  onChange,
  teams,
  positions,
  disabled,
}: PlayerFiltersProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Équipe</span>
        <Select
          value={value.teamId || "all"}
          onValueChange={(teamId) =>
            onChange({ ...value, teamId: teamId === "all" ? "" : teamId })
          }
          disabled={disabled}
        >
          <SelectTrigger aria-label="Filtrer par équipe">
            <SelectValue placeholder="Toutes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les équipes</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Poste principal</span>
        <Select
          value={value.positionId || "all"}
          onValueChange={(positionId) =>
            onChange({
              ...value,
              positionId: positionId === "all" ? "" : positionId,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger aria-label="Filtrer par poste">
            <SelectValue placeholder="Tous" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les postes</SelectItem>
            {positions.map((position) => (
              <SelectItem key={position.id} value={position.id}>
                {position.code} — {position.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Statut</span>
        <Select
          value={value.status}
          onValueChange={(status) =>
            onChange({
              ...value,
              status: status as PlayerFilterState["status"],
            })
          }
          disabled={disabled}
        >
          <SelectTrigger aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Archivés</SelectItem>
            <SelectItem value="all">Tous</SelectItem>
          </SelectContent>
        </Select>
      </label>

      <p className="sm:col-span-3 text-xs text-muted">
        Club et catégorie joueur : non exposés par FastAPI — filtres indisponibles.
      </p>
    </div>
  );
}
