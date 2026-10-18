import { describe, it, expect } from 'vitest';

import changedValues from '../src/utils/changedValues';

describe('changedValues', () => {
  it('keeps only what differs from the seed, refs compared by content', () => {
    const refs = [{ id: 'e1', assetId: 'a1' }];
    const original = { text: 'hi', assetRefs: refs, postedAt: null };
    expect(changedValues(original, { text: 'hi', assetRefs: [{ id: 'e1', assetId: 'a1' }], postedAt: null })).toEqual(
      {},
    );
    expect(changedValues(original, { text: 'hello', assetRefs: refs, postedAt: 5 })).toEqual({
      text: 'hello',
      postedAt: 5,
    });
    expect(changedValues(original, { text: 'hi', assetRefs: [], postedAt: null })).toEqual({ assetRefs: [] });
  });
});
