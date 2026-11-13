import { VISUAL_TRACKING_CONFIG } from "./config";

export type MovingItem = {
  value: number;
  /** Top-left corner, in px, relative to the game area. */
  x: number;
  y: number;
  /** Velocity in px per second. */
  vx: number;
  vy: number;
};

export type AreaSize = {
  width: number;
  height: number;
};

const { itemSize, minSpeed, maxSpeed, spawnAttempts } = VISUAL_TRACKING_CONFIG;

const maxX = (area: AreaSize) => Math.max(0, area.width - itemSize);
const maxY = (area: AreaSize) => Math.max(0, area.height - itemSize);

function randomVelocity(area: AreaSize) {
  const base = Math.min(area.width, area.height);
  const speed = (minSpeed + Math.random() * (maxSpeed - minSpeed)) * base;
  const angle = Math.random() * Math.PI * 2;
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

function overlapsAny(x: number, y: number, items: MovingItem[]) {
  return items.some(
    (item) => Math.hypot(item.x - x, item.y - y) < itemSize,
  );
}

/** Spawns items at random positions, avoiding overlaps when space allows. */
export function createMovingItems(
  values: number[],
  area: AreaSize,
): MovingItem[] {
  const items: MovingItem[] = [];
  for (const value of values) {
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < spawnAttempts; attempt++) {
      x = Math.random() * maxX(area);
      y = Math.random() * maxY(area);
      if (!overlapsAny(x, y, items)) break;
    }
    items.push({ value, x, y, ...randomVelocity(area) });
  }
  return items;
}

/** Advances every item in place and bounces it off the area boundaries. */
export function stepMovingItems(
  items: MovingItem[],
  deltaSeconds: number,
  area: AreaSize,
) {
  const limitX = maxX(area);
  const limitY = maxY(area);

  for (const item of items) {
    item.x += item.vx * deltaSeconds;
    item.y += item.vy * deltaSeconds;

    if (item.x <= 0) {
      item.x = 0;
      item.vx = Math.abs(item.vx);
    } else if (item.x >= limitX) {
      item.x = limitX;
      item.vx = -Math.abs(item.vx);
    }

    if (item.y <= 0) {
      item.y = 0;
      item.vy = Math.abs(item.vy);
    } else if (item.y >= limitY) {
      item.y = limitY;
      item.vy = -Math.abs(item.vy);
    }
  }
}

/**
 * Returns the item pressed at (x, y). When numbers overlap, the target wins
 * so a correct tap is never stolen by a number drawn on top of it.
 */
export function findPressedItem(
  items: MovingItem[],
  x: number,
  y: number,
  targetValue: number | null,
): MovingItem | null {
  const radius = itemSize / 2;
  let closest: MovingItem | null = null;
  let closestDistance = Infinity;

  for (const item of items) {
    const distance = Math.hypot(item.x + radius - x, item.y + radius - y);
    if (distance > radius) continue;
    if (item.value === targetValue) return item;
    if (distance < closestDistance) {
      closest = item;
      closestDistance = distance;
    }
  }
  return closest;
}

/** Keeps items inside the area after it has been resized. */
export function clampMovingItems(items: MovingItem[], area: AreaSize) {
  const limitX = maxX(area);
  const limitY = maxY(area);
  for (const item of items) {
    item.x = Math.min(Math.max(item.x, 0), limitX);
    item.y = Math.min(Math.max(item.y, 0), limitY);
  }
}
