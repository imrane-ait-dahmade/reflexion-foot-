export function randomInt(min: number, max: number, rand = Math.random()) {
  return Math.floor(rand * (max - min + 1)) + min;
}

/** Returns `count` distinct integers in [min, max], in random order. */
export function sampleUniqueInts(count: number, min: number, max: number) {
  const rangeSize = max - min + 1;
  if (count > rangeSize) {
    throw new Error(
      `Cannot pick ${count} unique numbers from range [${min}, ${max}].`,
    );
  }

  const pool = Array.from({ length: rangeSize }, (_, i) => min + i);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (rangeSize - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
