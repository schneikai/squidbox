import { afterEach, describe, expect, it, vi } from 'vitest';

import assignLetters from '../src/features/model-compare/assignLetters';

afterEach(() => vi.restoreAllMocks());

describe('assignLetters', () => {
  it('labels every model once, A to D in the shuffled order', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const letters = assignLetters(ids);
    expect(letters.map(({ label }) => label)).toEqual(['Model A', 'Model B', 'Model C', 'Model D']);
    expect(letters.map(({ modelId }) => modelId).sort()).toEqual(ids);
  });

  it('takes its order from Math.random', () => {
    // Fisher–Yates with j = 0 every time moves each last element to the front: [a,b,c] → [b,c,a].
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(assignLetters(['a', 'b', 'c'])).toEqual([
      { modelId: 'b', label: 'Model A' },
      { modelId: 'c', label: 'Model B' },
      { modelId: 'a', label: 'Model C' },
    ]);
  });
});
