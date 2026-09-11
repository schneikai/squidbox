import { describe, it, expect } from 'vitest';
import { keyBetween, initialKeys } from '@squidbox/shared';

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
