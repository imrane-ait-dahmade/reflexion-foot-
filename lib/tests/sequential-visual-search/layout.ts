export const SEQUENTIAL_TOTAL = 50;

const RINGS = [1, 6, 12, 15, 16];
const RADII = [0, 10, 18, 26, 34];

export type NumberSlot = {
  number: number;
  x: number;
  y: number;
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function circleSlots() {
  const slots: { x: number; y: number }[] = [];
  RINGS.forEach((count, ring) => {
    const radius = RADII[ring];
    const turn = ring * 0.4;
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + turn + (index / count) * Math.PI * 2;
      slots.push({
        x: Math.round((50 + radius * Math.cos(angle)) * 100) / 100,
        y: Math.round((50 + radius * Math.sin(angle)) * 100) / 100,
      });
    }
  });
  return slots;
}

/** Unbiased Fisher–Yates driven by a session seed. */
export function shuffleNumbers(sessionId: string) {
  const numbers = Array.from({ length: SEQUENTIAL_TOTAL }, (_, index) => index + 1);
  const random = mulberry32(hashString(`${sessionId}:sequential-visual-search`));
  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [numbers[index], numbers[swap]] = [numbers[swap], numbers[index]];
  }
  return numbers;
}

/** Same session id always returns the same non-overlapping layout. */
export function layoutForSession(sessionId: string): NumberSlot[] {
  const slots = circleSlots();
  return shuffleNumbers(sessionId).map((number, index) => ({
    number,
    x: slots[index].x,
    y: slots[index].y,
  }));
}
