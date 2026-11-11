import { describe, expect, it } from 'vitest';

import seesLine from '../src/features/post-chat/seesLine';

describe('seesLine', () => {
  it('shows the tags once a photo is tagged, also while others are', () => {
    expect(seesLine([{ tags: ['ridge'] }, { tags: null }], true, ['ridge'])).toEqual({
      tagsText: 'ridge',
      isLooking: true,
    });
  });

  it('says it is looking, without tags, while no photo is tagged yet', () => {
    expect(seesLine([{ tags: null }], true, [])).toEqual({ tagsText: null, isLooking: true });
  });

  it('says no tags once nothing is being tagged', () => {
    expect(seesLine([{ tags: null }], false, [])).toEqual({ tagsText: 'no tags', isLooking: false });
  });
});
