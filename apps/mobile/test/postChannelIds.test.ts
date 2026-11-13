import { describe, expect, it } from 'vitest';

import postChannelIds from '../src/features/channels/postChannelIds';

describe('postChannelIds', () => {
  it("puts the post's own channel first, then the others in the user's order", () => {
    const post = { channelId: 'x', otherChannelIds: ['instagram', 'onlyfans', 'bluesky'] };
    expect(postChannelIds(post, ['bluesky', 'x', 'onlyfans', 'instagram'])).toEqual([
      'x',
      'bluesky',
      'onlyfans',
      'instagram',
    ]);
  });

  it("puts channels no longer in the user's list after it, in the catalog's order", () => {
    const post = { channelId: 'onlyfans', otherChannelIds: ['reddit', 'threads', 'tiktok'] };
    expect(postChannelIds(post, ['tiktok'])).toEqual(['onlyfans', 'tiktok', 'threads', 'reddit']);
  });

  it('shows a channel once, also when two other channels of the post are on it', () => {
    const post = { channelId: 'x', otherChannelIds: ['onlyfans', 'onlyfans', 'x'] };
    expect(postChannelIds(post, ['x', 'onlyfans'])).toEqual(['x', 'onlyfans']);
  });

  it('shows none for a post without channels', () => {
    expect(postChannelIds({ channelId: null, otherChannelIds: [] }, ['x'])).toEqual([]);
  });
});
