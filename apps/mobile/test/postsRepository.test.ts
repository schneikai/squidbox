import { describe, it, expect } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import { readNewestRepostDate, readPostTexts } from '../src/sync/postsRepository';
import { makeRepository } from '../src/sync/repository';

const posts = makeRepository('posts', schema.posts);
const post = (id: string, over: Record<string, unknown>) => ({
  id,
  createdAt: Number(id.slice(1)),
  updatedAt: 1,
  deletedAt: null,
  text: '',
  isFavorite: false,
  postedAt: null,
  rePostId: null,
  isIgnoredForRepost: false,
  suggestRepostAt: 0,
  hasBeenReposted: false,
  ...over,
});

describe('postsRepository', () => {
  it('reads the non-empty texts of the non-deleted posts, newest first', async () => {
    const db = makeTestDb();
    expect(await readPostTexts(db)).toEqual([]);
    await posts.createMany(db, [
      post('p1', { text: ' one ' }),
      post('p2', { text: '  ' }),
      post('p3', { text: 'three', deletedAt: 5 }),
      post('p4', { text: 'four' }),
    ]);
    expect(await readPostTexts(db)).toEqual(['four', 'one']);
  });

  it('reads the newest repost suggestion or post date of the non-deleted posts', async () => {
    const db = makeTestDb();
    expect(await readNewestRepostDate(db)).toBe(0);
    await posts.createMany(db, [
      post('p1', { suggestRepostAt: 0, postedAt: 50 }), // falls back to the post date
      post('p2', { suggestRepostAt: 40, postedAt: 90 }),
      post('p3', { suggestRepostAt: 99, deletedAt: 5 }),
    ]);
    expect(await readNewestRepostDate(db)).toBe(50);
  });
});
