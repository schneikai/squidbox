import { describe, expect, it } from 'vitest';

import deletePostMessage from '../src/features/post-detail/actions/deletePostMessage';

describe('deletePostMessage', () => {
  it('asks plainly about a single post', () => {
    expect(deletePostMessage({ threadCount: 0, otherChannelCount: 0, channelNames: [] })).toBe(
      'Are you sure you want to delete this post?',
    );
  });

  it("counts a thread's posts", () => {
    expect(deletePostMessage({ threadCount: 2, otherChannelCount: 0, channelNames: ['X'] })).toBe(
      'This deletes all 3 posts of the thread.',
    );
  });

  it('names every channel of a post on more than one', () => {
    expect(deletePostMessage({ threadCount: 2, otherChannelCount: 1, channelNames: ['X', 'OnlyFans'] })).toBe(
      'This deletes the post on all its channels: X and OnlyFans.',
    );
    expect(
      deletePostMessage({ threadCount: 0, otherChannelCount: 2, channelNames: ['X', 'Bluesky', 'OnlyFans'] }),
    ).toBe('This deletes the post on all its channels: X, Bluesky and OnlyFans.');
  });

  it('says a post with other channels is deleted on all of them, also when they show as one channel', () => {
    // No channel of its own and one other; two other channels on OnlyFans.
    expect(deletePostMessage({ threadCount: 0, otherChannelCount: 1, channelNames: ['OnlyFans'] })).toBe(
      'This deletes the post on all its channels.',
    );
    expect(deletePostMessage({ threadCount: 0, otherChannelCount: 2, channelNames: ['OnlyFans'] })).toBe(
      'This deletes the post on all its channels.',
    );
  });
});
