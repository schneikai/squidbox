import { describe, it, expect } from 'vitest';
import { keyBetween, initialKeys, keysBetween, keysInOrder, longestIncreasing } from '@squidbox/shared';

// keyBetween must always return a key strictly between its neighbors (lexicographically), so a
// reorder/insert only rewrites one row's key and order stays stable + convergent.
describe('fractionalIndex', () => {
  it('keyBetween(null, null) is a valid non-empty key', () => {
    const k = keyBetween(null, null);
    expect(k).toBeTruthy();
  });

  it('appends and prepends produce strictly ordered keys', () => {
    const a = keyBetween(null, null);
    const afterA = keyBetween(a, null);
    const beforeA = keyBetween(null, a);
    expect(beforeA < a).toBe(true);
    expect(a < afterA).toBe(true);
  });

  it('always finds a key strictly between two adjacent keys', () => {
    let lo = keyBetween(null, null);
    let hi = keyBetween(lo, null);
    // Repeatedly insert between lo and hi; each must land strictly between.
    for (let i = 0; i < 200; i++) {
      const mid = keyBetween(lo, hi);
      expect(lo < mid).toBe(true);
      expect(mid < hi).toBe(true);
      // Alternate which side we tighten to stress both branches.
      if (i % 2 === 0) hi = mid;
      else lo = mid;
    }
  });

  it('initialKeys(n) is strictly increasing and length n', () => {
    const keys = initialKeys(50);
    expect(keys).toHaveLength(50);
    for (let i = 1; i < keys.length; i++) expect(keys[i - 1] < keys[i]).toBe(true);
  });

  it('rejects an inverted range', () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    expect(() => keyBetween(b, a)).toThrow();
  });
});

// keysInOrder: a target sequence of items with their current keys (null: none) gets keys in its order,
// distinct, inside the bounds, changing only the items outside one longest strictly increasing run.
// Sequences come from concurrent edits: appends tied on two offline devices (keyBetween(last, null)
// is deterministic), moves, inserts of new items, and edges never placed.
describe('keysInOrder (property)', () => {
  function prng(seed: number) {
    let a = seed >>> 0;
    return (n: number) => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
  }

  function sequence(int: (n: number) => number): (string | null)[] {
    const keys: (string | null)[] = initialKeys(1 + int(8));
    for (let step = int(12); step > 0; step--) {
      const op = int(4);
      const sorted = keys.filter((k): k is string => k !== null).sort();
      if (op === 0) {
        const tied = keyBetween(sorted.at(-1) ?? null, null); // two devices append the same key
        keys.push(tied, tied);
      } else if (op === 1 && keys.length > 1) {
        const [moved] = keys.splice(int(keys.length), 1); // a move: the order changes, the key doesn't
        keys.splice(int(keys.length + 1), 0, moved!);
      } else if (op === 2) keys.splice(int(keys.length + 1), 0, null); // a new item
      else keys.splice(int(keys.length + 1), 0, keys[int(keys.length)] ?? null); // a tie anywhere
    }
    return keys;
  }

  it('keys every sequence in its order, distinct and inside the bounds, re-keying only outside a longest run', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const int = prng(seed);
      const current = sequence(int);
      const sorted = current.filter((k): k is string => k !== null).sort();
      const bounded = int(3) === 0 && sorted.length > 1;
      const [lower, upper] = bounded
        ? (() => {
            const [a, b] = [sorted[int(sorted.length)]!, sorted[int(sorted.length)]!].sort();
            return a === b ? [null, null] : [a, b];
          })()
        : [null, null];
      const keys = keysInOrder(current, lower, upper);
      const context = `seed ${seed}: ${JSON.stringify({ current, lower, upper, keys })}`;
      expect(keys, context).toHaveLength(current.length);
      for (let i = 1; i < keys.length; i++) expect(keys[i - 1]! < keys[i]!, context).toBe(true);
      if (lower !== null) expect(keys.every((k) => k > lower), context).toBe(true);
      if (upper !== null) expect(keys.every((k) => k < upper), context).toBe(true);
      const inside = current.map((k) => (k !== null && (lower === null || k > lower) && (upper === null || k < upper) ? k : null));
      const unchanged = keys.filter((k, i) => k === current[i]).length;
      expect(unchanged, context).toBe(longestIncreasing(inside).size);
    }
  });

  it('keeps every key of a sequence already in order, and spreads a run like keysBetween', () => {
    const keys = initialKeys(5);
    expect(keysInOrder(keys)).toEqual(keys);
    expect(keysInOrder([keys[0]!, null, null, keys[1]!])).toEqual([keys[0], ...keysBetween(keys[0]!, keys[1]!, 2), keys[1]]);
  });
});
