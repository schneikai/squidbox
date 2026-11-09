import { describe, expect, it } from 'vitest';

import rankSampleTags from '../src/features/album-tags/rankSampleTags';

describe('rankSampleTags', () => {
  it('puts the tags more photos share first, ties in first-appearance order, each once in any case', () => {
    const lists = [
      ['fog', 'Moss', 'creek'],
      ['moss', 'tent'],
      ['fog', 'MOSS', 'trail'],
    ];
    expect(rankSampleTags(lists, 10)).toEqual(['Moss', 'fog', 'creek', 'tent', 'trail']);
  });

  it('keeps at most max tags, the most shared ones', () => {
    expect(rankSampleTags([['a', 'b', 'c'], ['c']], 2)).toEqual(['c', 'a']);
  });
});
