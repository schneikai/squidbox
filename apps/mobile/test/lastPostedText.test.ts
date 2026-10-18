import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import lastPostedText from '../src/features/post-random-suggestions/lastPostedText';

const NOW = new Date(2026, 9, 11, 15, 0).getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('lastPostedText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('says how long ago the asset and its album were posted', () => {
    const album = { name: 'Beach', lastPostedAt: NOW - 2 * DAY };
    expect(lastPostedText({ lastPostedAt: NOW - 3 * DAY, album })).toEqual({
      title: 'Last posted 3 days ago',
      subtitle: 'Album “Beach” last posted 2 days ago',
    });
  });

  it('says when neither was posted', () => {
    expect(lastPostedText({ lastPostedAt: null, album: { name: 'Beach', lastPostedAt: null } })).toEqual({
      title: 'Never posted',
      subtitle: 'Album “Beach” never posted',
    });
  });

  it('says when the asset is in no album', () => {
    expect(lastPostedText({ lastPostedAt: NOW - 2 * HOUR, album: null })).toEqual({
      title: 'Last posted 2 hours ago',
      subtitle: 'Not in an album',
    });
  });
});
