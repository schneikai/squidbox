import { describe, expect, it } from 'vitest';

import locateRule from '../src/features/voice/locateRule';

describe('locateRule', () => {
  it('finds the rule where it was', () => {
    expect(locateRule(['a', 'b', 'c'], { index: 1, text: 'b' })).toBe(1);
  });

  it('finds the rule another device moved', () => {
    expect(locateRule(['b', 'a', 'c'], { index: 1, text: 'b' })).toBe(0);
  });

  it('reports a rule changed and not found elsewhere as gone', () => {
    expect(locateRule(['a', 'x', 'c'], { index: 1, text: 'b' })).toBe(-1);
  });

  it('prefers the seeded index when two rules say the same', () => {
    expect(locateRule(['b', 'a', 'b'], { index: 2, text: 'b' })).toBe(2);
  });

  it('reports a rule in an empty list as gone', () => {
    expect(locateRule([], { index: 0, text: 'b' })).toBe(-1);
  });
});
