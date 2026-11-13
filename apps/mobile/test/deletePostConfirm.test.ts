import { describe, expect, it } from 'vitest';

import deletePostConfirm from '../src/features/post-detail/actions/deletePostConfirm';

describe('deletePostConfirm', () => {
  it('asks plainly about a single post', () => {
    expect(deletePostConfirm({ threadCount: 0, otherChannelCount: 0, channelNames: [] })).toEqual({
      name: 'this post',
    });
  });

  it("counts a thread's posts", () => {
    expect(deletePostConfirm({ threadCount: 2, otherChannelCount: 0, channelNames: ['X'] })).toEqual({
      name: 'this thread',
      also: 'All 3 of its posts go.',
    });
  });

  it('names every channel of a post on more than one', () => {
    expect(deletePostConfirm({ threadCount: 2, otherChannelCount: 1, channelNames: ['X', 'OnlyFans'] }).also).toBe(
      'It goes on all its channels: X and OnlyFans.',
    );
    expect(
      deletePostConfirm({ threadCount: 0, otherChannelCount: 2, channelNames: ['X', 'Bluesky', 'OnlyFans'] }).also,
    ).toBe('It goes on all its channels: X, Bluesky and OnlyFans.');
  });

  it('says a post with other channels goes on all of them, also when they show as one channel', () => {
    // No channel of its own and one other; two other channels on OnlyFans.
    expect(deletePostConfirm({ threadCount: 0, otherChannelCount: 1, channelNames: ['OnlyFans'] })).toEqual({
      name: 'this post',
      also: 'It goes on all its channels.',
    });
    expect(deletePostConfirm({ threadCount: 0, otherChannelCount: 2, channelNames: ['OnlyFans'] }).also).toBe(
      'It goes on all its channels.',
    );
  });
});
