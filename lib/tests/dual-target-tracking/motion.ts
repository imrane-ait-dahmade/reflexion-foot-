import { createHash } from "node:crypto";
import { unitFloat } from "@/lib/tests/challenge-token";
import { ORB_RADIUS, dualLevel } from "./config";

export type Orb = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

const MIN_GAP = ORB_RADIUS * 2.15;

export function targetPair(seed: string, level: number, secret: string) {
  const config = dualLevel(level);
  if (!config) throw new Error("Niveau inconnu.");
  const order = Array.from({ length: config.objects }, (_, id) => id);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(
      unitFloat(secret, `${seed}:dual-targets:${level}:${index}`) * (index + 1),
    );
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return [order[0], order[1]].sort((a, b) => a - b) as [number, number];
}

function publicUnit(message: string) {
  const digest = createHash("sha256").update(message).digest();
  return digest.readUInt32BE(0) / 0x100000000;
}

export function createOrbs(sessionId: string, level: number): Orb[] {
  const config = dualLevel(level);
  if (!config) throw new Error("Niveau inconnu.");
  return Array.from({ length: config.objects }, (_, id) => {
    const angle = publicUnit(`${sessionId}:dual-angle:${level}:${id}`) * Math.PI * 2;
    return {
      id,
      x: ORB_RADIUS + publicUnit(`${sessionId}:dual-x:${level}:${id}`) * (1 - ORB_RADIUS * 2),
      y: ORB_RADIUS + publicUnit(`${sessionId}:dual-y:${level}:${id}`) * (1 - ORB_RADIUS * 2),
      vx: Math.cos(angle) * config.speed,
      vy: Math.sin(angle) * config.speed,
    };
  });
}

function clampOrb(orb: Orb) {
  const low = ORB_RADIUS;
  const high = 1 - ORB_RADIUS;
  if (orb.x < low) {
    orb.x = low;
    orb.vx = Math.abs(orb.vx);
  } else if (orb.x > high) {
    orb.x = high;
    orb.vx = -Math.abs(orb.vx);
  }
  if (orb.y < low) {
    orb.y = low;
    orb.vy = Math.abs(orb.vy);
  } else if (orb.y > high) {
    orb.y = high;
    orb.vy = -Math.abs(orb.vy);
  }
}

/** Moves every orb and keeps its id. Positions stay inside the area. */
export function stepOrbs(orbs: Orb[], deltaSeconds: number): Orb[] {
  const next = orbs.map((orb) => ({
    ...orb,
    x: orb.x + orb.vx * deltaSeconds,
    y: orb.y + orb.vy * deltaSeconds,
  }));
  for (const orb of next) clampOrb(orb);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        let dx = next[j].x - next[i].x;
        let dy = next[j].y - next[i].y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        if (dist >= MIN_GAP) continue;
        const push = (MIN_GAP - dist) / 2;
        dx /= dist;
        dy /= dist;
        next[i].x -= dx * push;
        next[i].y -= dy * push;
        next[j].x += dx * push;
        next[j].y += dy * push;
      }
    }
    for (const orb of next) clampOrb(orb);
  }
  return next;
}

export function gradeTargetSelection(targets: readonly number[], selected: number[]) {
  if (selected.length !== 2 || selected[0] === selected[1]) {
    return { error: "Sélectionne deux cibles différentes." as const };
  }
  if (selected.some((id) => !Number.isInteger(id) || id < 0)) {
    return { error: "Sélection invalide." as const };
  }
  const correct = selected.filter((id) => targets.includes(id)).length;
  const incorrect = selected.filter((id) => !targets.includes(id)).length;
  return {
    correctlyIdentifiedTargets: correct,
    missedTargets: targets.length - correct,
    incorrectSelections: incorrect,
    both: correct === targets.length,
  };
}

export function simulateMovement(orbs: Orb[], durationMs: number, stepMs = 50) {
  let current = orbs;
  const steps = Math.ceil(durationMs / stepMs);
  for (let step = 0; step < steps; step += 1) {
    current = stepOrbs(current, stepMs / 1000);
  }
  return current;
}
