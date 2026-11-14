import { describe, expect, it } from 'vitest';

import postChannelIds from '../src/features/channels/postChannelIds';

describe('postChannelIds', () => {
  it("puts the post's own channel first, then the others in the user's order", () => {
    const post = { channelIds: ['x'], otherChannelIds: ['instagram', 'onlyfans', 'bluesky'] };
    expect(postChannelIds(post, ['bluesky', 'x', 'onlyfans', 'instagram'])).toEqual([
      'x',
      'bluesky',
      'onlyfans',
      'instagram',
    ]);
  });

  it("puts channels no longer in the user's list after it, in the catalog's order", () => {
    const post = { channelIds: ['onlyfans'], otherChannelIds: ['reddit', 'threads', 'tiktok'] };
    expect(postChannelIds(post, ['tiktok'])).toEqual(['onlyfans', 'tiktok', 'threads', 'reddit']);
  });

  it('shows a channel once, also when two other channels of the post are on it', () => {
    const post = { channelIds: ['x'], otherChannelIds: ['onlyfans', 'onlyfans', 'x'] };
    expect(postChannelIds(post, ['x', 'onlyfans'])).toEqual(['x', 'onlyfans']);
  });

  it('shows none for a post without channels', () => {
    expect(postChannelIds({ channelIds: [], otherChannelIds: [] }, ['x'])).toEqual([]);
  });

  it("orders every channel of a post without one of its own in the user's order", () => {
    const post = { channelIds: [], otherChannelIds: ['onlyfans', 'x', 'bluesky'] };
    expect(postChannelIds(post, ['bluesky', 'x', 'onlyfans'])).toEqual(['bluesky', 'x', 'onlyfans']);
  });

  it("shows the post's own other channels among its other versions'", () => {
    const post = { channelIds: ['bluesky', 'x'], otherChannelIds: ['onlyfans'] };
    expect(postChannelIds(post, ['onlyfans', 'x', 'bluesky'])).toEqual(['bluesky', 'onlyfans', 'x']);
    expect(postChannelIds({ channelIds: ['bluesky', 'x'], otherChannelIds: [] }, [])).toEqual(['bluesky', 'x']);
  });
});
