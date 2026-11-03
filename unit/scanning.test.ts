import { describe, expect, it } from "vitest";
import {
  PITCH_HEIGHT_M,
  PITCH_WIDTH_M,
  SCANNING_ATTRIBUTION,
  SCANNING_SEQUENCES,
  correctPlayer,
  distanceMeters,
  type ScanningSequence,
  type TrackingPlayer,
} from "@/lib/tests/football-visual-scanning/answers";

function playersNear(ball: { x: number; y: number }) {
  return [...SCANNING_SEQUENCES]
    .flatMap((sequence) => sequence.players)
    .slice(0, 0)
    .concat([])
    .concat(
      SCANNING_SEQUENCES.flatMap((sequence) =>
        sequence.id ? [] : [],
      ),
    ) && ball;
}

describe("lecture du jeu", () => {
  it("uses nine real frames with a visible ball and separable players", () => {
    expect(SCANNING_SEQUENCES).toHaveLength(9);
    expect(SCANNING_ATTRIBUTION).toMatch(/Metrica Sports/);
    const challenges = SCANNING_SEQUENCES.map((sequence) => sequence.challenge);
    expect(challenges.filter((type) => type === "closest")).toHaveLength(3);
    expect(challenges.filter((type) => type === "defender")).toHaveLength(3);
    expect(challenges.filter((type) => type === "free")).toHaveLength(3);

    for (const sequence of SCANNING_SEQUENCES) {
      expect(sequence.ball.x).toBeGreaterThanOrEqual(0);
      expect(sequence.ball.x).toBeLessThanOrEqual(1);
      expect(sequence.ball.y).toBeGreaterThanOrEqual(0);
      expect(sequence.ball.y).toBeLessThanOrEqual(1);
      expect(sequence.players.length).toBeGreaterThanOrEqual(20);
      for (const player of sequence.players) {
        expect(Number.isFinite(player.x)).toBe(true);
        expect(Number.isFinite(player.y)).toBe(true);
      }
      let closestPair = Infinity;
      for (let i = 0; i < sequence.players.length; i += 1) {
        for (let j = i + 1; j < sequence.players.length; j += 1) {
          closestPair = Math.min(
            closestPair,
            distanceMeters(sequence.players[i], sequence.players[j]),
          );
        }
      }
      expect(closestPair).toBeGreaterThanOrEqual(3.4);
      expect(correctPlayer(sequence).playerId).toBeTruthy();
    }
  });

  it("measures the pitch in metres from normalized coordinates", () => {
    expect(distanceMeters({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(PITCH_WIDTH_M);
    expect(distanceMeters({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(PITCH_HEIGHT_M);
  });

  it("picks the closest player, the nearest opponent, then the freest teammate", () => {
    const ball = { x: 0.5, y: 0.5 };
    const players: TrackingPlayer[] = [
      { playerId: "9", teamId: "home", x: 0.52, y: 0.5 },
      { playerId: "2", teamId: "home", x: 0.2, y: 0.5 },
      { playerId: "4", teamId: "home", x: 0.8, y: 0.2 },
      { playerId: "18", teamId: "away", x: 0.55, y: 0.5 },
      { playerId: "21", teamId: "away", x: 0.9, y: 0.8 },
    ];
    const base = {
      id: "synthetic",
      matchId: "sample-game-1",
      period: 1,
      frame: 1,
      time: 1,
      ball,
      players,
    };

    expect(correctPlayer({ ...base, challenge: "closest" }).playerId).toBe("9");
    expect(correctPlayer({ ...base, challenge: "defender" })).toMatchObject({
      playerId: "18",
      teamId: "away",
    });
    expect(correctPlayer({ ...base, challenge: "free" }).playerId).toBe("4");
  });

  it("breaks a distance tie by player id", () => {
    const sequence: ScanningSequence = {
      id: "tie",
      matchId: "sample-game-1",
      challenge: "closest",
      period: 1,
      frame: 2,
      time: 2,
      ball: { x: 0.5, y: 0.5 },
      players: [
        { playerId: "8", teamId: "home", x: 0.6, y: 0.5 },
        { playerId: "3", teamId: "away", x: 0.4, y: 0.5 },
      ],
    };
    expect(distanceMeters(sequence.players[0], sequence.ball)).toBe(
      distanceMeters(sequence.players[1], sequence.ball),
    );
    expect(correctPlayer(sequence).playerId).toBe("3");
  });
});

void playersNear;
