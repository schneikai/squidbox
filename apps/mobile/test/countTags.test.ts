import { describe, expect, it } from 'vitest';

import countTags from '../src/features/album-tags/countTags';

describe('countTags', () => {
  it('puts the tags more photos share first, ties in first-appearance order, each once in any case', () => {
    const lists = [['fog', 'Moss', 'creek'], ['moss', 'tent'], null, ['fog', 'MOSS', 'trail']];
    expect(countTags(lists).map(({ tag, count }) => [tag, count])).toEqual([
      ['Moss', 3],
      ['fog', 2],
      ['creek', 1],
      ['tent', 1],
      ['trail', 1],
    ]);
  });
});
