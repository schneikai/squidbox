import { describe, expect, it } from 'vitest';

import seesLine from '../src/features/post-chat/seesLine';

describe('seesLine', () => {
  it('shows the tags once a photo is tagged, also while others are', () => {
    expect(seesLine([{ tags: ['ridge'] }, { tags: null }], true, ['ridge'])).toBe('ridge');
  });

  it('shows nothing while no photo is tagged yet', () => {
    expect(seesLine([{ tags: null }], true, [])).toBeNull();
  });

  it('says no tags once nothing is being tagged, or nothing where no-tags is left out', () => {
    expect(seesLine([{ tags: null }], false, [])).toBe('no tags');
    expect(seesLine([{ tags: null }], false, [], null)).toBeNull();
  });
});
