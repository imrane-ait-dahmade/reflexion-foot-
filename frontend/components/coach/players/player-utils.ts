import type { PlayerResponse, PositionResponse } from "@/lib/api/types";

export function playerFullName(player: Pick<PlayerResponse, "first_name" | "last_name">) {
  return `${player.first_name} ${player.last_name}`.trim();
}

export function playerInitials(player: Pick<PlayerResponse, "first_name" | "last_name">) {
  const first = player.first_name.trim().charAt(0);
  const last = player.last_name.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

export function formatPositions(player: PlayerResponse) {
  const primary =
    player.primary_position?.code ??
    player.primary_position?.name ??
    null;
  const secondary = (player.secondary_positions ?? [])
    .map((position) => position.code || position.name)
    .filter(Boolean);
  const codes = [primary, ...secondary].filter(Boolean) as string[];
  return codes.length > 0 ? codes.join(" · ") : "—";
}

export function positionLabel(position: PositionResponse | null | undefined) {
  if (!position) return "—";
  return `${position.code} — ${position.name}`;
}

export type PlayerTeamMap = Record<string, string[]>;

export function teamsForPlayer(map: PlayerTeamMap, playerId: string) {
  return map[playerId] ?? [];
}
