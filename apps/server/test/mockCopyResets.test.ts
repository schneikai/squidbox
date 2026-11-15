import { describe, expect, it } from 'vitest';
import { mockCopyResets } from '../scripts/mockCopyResets.js';

const copy = (id: string, postId: string, deletedAt: number | null = null) => ({
  id,
  createdAt: 1,
  updatedAt: 1,
  deletedAt,
  postId,
  channelId: 'x',
  sentAt: 5,
  posts: [{ text: 'Ridge at dawn', mentions: null, assetIds: [] }],
});

describe('mockCopyResets', () => {
  it("moves the app's live and removed copies of a kept post off it, tombstoned, and leaves a mock copy and another post's copy out", () => {
    const records = [
      copy('made', 'forest'),
      copy('removed', 'forest', 3),
      copy('mock', 'forest'),
      copy('other', 'gone'),
    ];
    expect(mockCopyResets(records, new Set(['mock', 'forest']), new Set(['forest']), 100)).toEqual([
      { collection: 'post_copies', record: { ...copy('made', 'made', 100), updatedAt: 100 } },
      { collection: 'post_copies', record: { ...copy('removed', 'removed', 3), updatedAt: 100 } },
    ]);
  });
});
