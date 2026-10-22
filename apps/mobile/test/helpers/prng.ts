/** A seeded pseudo-random source (mulberry32), for seeded fuzz runs that replay exactly. */
export function prng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!,
    chance: (p: number) => next() < p,
  };
}

export type Prng = ReturnType<typeof prng>;
