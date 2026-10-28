import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import editedTags from '../src/features/photo-tags/editedTags';

describe('editedTags', () => {
  it('takes a removed tag out in any case and leaves a photo without it as it was', () => {
    expect(editedTags(['Forest', 'fog'], { remove: ['forest'] })).toEqual(['fog']);
    expect(editedTags(['fog'], { remove: ['forest'] })).toBeNull();
    expect(editedTags(null, { remove: ['forest'] })).toBeNull();
  });

  it('adds a tag once, also to a photo never tagged', () => {
    expect(editedTags(['fog'], { add: ['ridge'] })).toEqual(['fog', 'ridge']);
    expect(editedTags(['Ridge'], { add: ['ridge'] })).toBeNull();
    expect(editedTags(null, { add: ['ridge'] })).toEqual(['ridge']);
  });

  it('skips an added tag on a photo already full', () => {
    const full = Array.from({ length: ASSET_TAG_LIMITS.tags }, (_, i) => `tag ${i}`);
    expect(editedTags(full, { add: ['ridge'] })).toBeNull();
    expect(editedTags(full, { add: ['ridge'], remove: ['tag 0'] })).toEqual([...full.slice(1), 'ridge']);
  });
});
