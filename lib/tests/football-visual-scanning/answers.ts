import data from "./sequences.json";

export const PITCH_WIDTH_M = 105;
export const PITCH_HEIGHT_M = 68;

export type TeamId = "home" | "away";
export type ChallengeType = "closest" | "defender" | "free";

export type TrackingPlayer = {
  playerId: string;
  teamId: TeamId;
  x: number;
  y: number;
};

export type ScanningSequence = {
  id: string;
  matchId: string;
  challenge: ChallengeType;
  period: number;
  frame: number;
  time: number;
  ball: { x: number; y: number };
  players: TrackingPlayer[];
};

export const SCANNING_ATTRIBUTION = data.attribution;
export const SCANNING_SEQUENCES = data.sequences as ScanningSequence[];

export function distanceMeters(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = (a.x - b.x) * PITCH_WIDTH_M;
  const dy = (a.y - b.y) * PITCH_HEIGHT_M;
  return Math.hypot(dx, dy);
}

function byDistance(ball: { x: number; y: number }) {
  return (a: TrackingPlayer, b: TrackingPlayer) =>
    distanceMeters(a, ball) - distanceMeters(b, ball) ||
    a.playerId.localeCompare(b.playerId);
}

/** Answers are derived from coordinates. Ties break on player id. */
export function correctPlayer(sequence: ScanningSequence): TrackingPlayer {
  const { players, ball, challenge } = sequence;
  const ranked = [...players].sort(byDistance(ball));
  const closest = ranked[0];
  if (challenge === "closest") return closest;

  if (challenge === "defender") {
    const defender = ranked.find((player) => player.teamId !== closest.teamId);
    if (!defender) throw new Error(`No defender in ${sequence.id}`);
    return defender;
  }

  const rankedFree = players
    .filter(
      (player) =>
        player.teamId === closest.teamId && player.playerId !== closest.playerId,
    )
    .map((player) => {
      const space = players
        .filter((other) => other.teamId !== player.teamId)
        .reduce(
          (best, other) => Math.min(best, distanceMeters(player, other)),
          Infinity,
        );
      return { player, space };
    })
    .sort(
      (a, b) =>
        b.space - a.space || a.player.playerId.localeCompare(b.player.playerId),
    );

  return rankedFree[0].player;
}

export const CHALLENGE_LABEL: Record<ChallengeType, string> = {
  closest: "Joueur le plus proche du ballon",
  defender: "Défenseur le plus proche du ballon",
  free: "Joueur le plus libre (le plus d'espace)",
};
