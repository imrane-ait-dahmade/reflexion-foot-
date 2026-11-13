import type { PointerEvent } from "react";
import {
  PITCH_HEIGHT_M,
  PITCH_WIDTH_M,
  type TrackingPlayer,
} from "@/lib/tests/football-visual-scanning/answers";

type PitchProps = {
  players: TrackingPlayer[];
  ball: { x: number; y: number };
  disabled?: boolean;
  onPick: (playerId: string) => void;
};

const BALL_R = 3.15;
const PICK_RADIUS_M = 6;

function meters(value: number, axis: "x" | "y") {
  return value * (axis === "x" ? PITCH_WIDTH_M : PITCH_HEIGHT_M);
}

function seams() {
  return Array.from({ length: 5 }, (_, index) => {
      const angle = ((-90 + index * 72) * Math.PI) / 180;
    return {
      x1: Math.cos(angle) * 0.95,
      y1: Math.sin(angle) * 0.95,
      x2: Math.cos(angle) * BALL_R,
      y2: Math.sin(angle) * BALL_R,
    };
  });
}

function Ball({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <ellipse cx="0.85" cy="1.05" rx="3.3" ry="0.75" fill="#04140f" opacity="0.6" />
      <circle r="3.7" fill="none" stroke="#04140f" strokeWidth="0.45" />
      <circle r={BALL_R} fill="#fffef8" stroke="#111" strokeWidth="0.42" />
      <circle r="0.9" fill="#111" />
      {seams().map((line) => (
        <line
          key={`${line.x2}-${line.y2}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#111"
          strokeWidth="0.22"
        />
      ))}
    </g>
  );
}

export function Pitch({ players, ball, disabled, onPick }: PitchProps) {
  const pick = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    let best: TrackingPlayer | null = null;
    let bestDistance = PICK_RADIUS_M;
    for (const player of players) {
      const distance = Math.hypot(
        local.x - meters(player.x, "x"),
        local.y - meters(player.y, "y"),
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = player;
      }
    }
    if (best) onPick(best.playerId);
  };

  return (
    <svg
      viewBox={`-4 -6 ${PITCH_WIDTH_M + 8} ${PITCH_HEIGHT_M + 12}`}
      className="h-auto w-full touch-manipulation rounded-xl border border-border bg-[#0c3b2e]"
      role="img"
      aria-label="Terrain de football"
      onPointerDown={pick}
    >
      <rect
        x="0"
        y="0"
        width={PITCH_WIDTH_M}
        height={PITCH_HEIGHT_M}
        fill="#0e4a38"
        stroke="#d7efe6"
        strokeWidth="0.6"
      />
      <line
        x1={PITCH_WIDTH_M / 2}
        y1="0"
        x2={PITCH_WIDTH_M / 2}
        y2={PITCH_HEIGHT_M}
        stroke="#d7efe6"
        strokeWidth="0.4"
      />
      <circle
        cx={PITCH_WIDTH_M / 2}
        cy={PITCH_HEIGHT_M / 2}
        r="9.15"
        fill="none"
        stroke="#d7efe6"
        strokeWidth="0.4"
      />
      <circle cx={PITCH_WIDTH_M / 2} cy={PITCH_HEIGHT_M / 2} r="0.6" fill="#d7efe6" />
      <rect x="0" y={(PITCH_HEIGHT_M - 40.32) / 2} width="16.5" height="40.32" fill="none" stroke="#d7efe6" strokeWidth="0.4" />
      <rect x={PITCH_WIDTH_M - 16.5} y={(PITCH_HEIGHT_M - 40.32) / 2} width="16.5" height="40.32" fill="none" stroke="#d7efe6" strokeWidth="0.4" />
      <rect x="0" y={(PITCH_HEIGHT_M - 18.32) / 2} width="5.5" height="18.32" fill="none" stroke="#d7efe6" strokeWidth="0.4" />
      <rect x={PITCH_WIDTH_M - 5.5} y={(PITCH_HEIGHT_M - 18.32) / 2} width="5.5" height="18.32" fill="none" stroke="#d7efe6" strokeWidth="0.4" />

      {players.map((player) => {
        const home = player.teamId === "home";
        const x = meters(player.x, "x");
        const y = meters(player.y, "y");
        return (
          <g key={`${player.teamId}-${player.playerId}`} pointerEvents="none">
            <circle
              cx={x}
              cy={y}
              r="2.15"
              fill={home ? "#008060" : "#f4f4f5"}
              stroke={home ? "#b7f3df" : "#111"}
              strokeWidth="0.35"
            />
          </g>
        );
      })}

      <Ball x={meters(ball.x, "x")} y={meters(ball.y, "y")} />

      {players.map((player) => {
        const home = player.teamId === "home";
        const x = meters(player.x, "x");
        const y = meters(player.y, "y");
        return (
          <text
            key={`num-${player.teamId}-${player.playerId}`}
            x={x}
            y={y + 0.75}
            textAnchor="middle"
            fontSize="2.25"
            fontWeight="700"
            fill={home ? "#fff" : "#111"}
            stroke={home ? "#064435" : "#fff"}
            strokeWidth="0.45"
            paintOrder="stroke"
            pointerEvents="none"
          >
            {player.playerId}
          </text>
        );
      })}
    </svg>
  );
}
