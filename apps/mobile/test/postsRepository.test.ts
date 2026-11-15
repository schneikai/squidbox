import type { PostRecord } from '@squidbox/shared';
import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord, makePostRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as assets from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { readMentionTexts, readNewestRepostDate } from '../src/sync/postsRepository';
import { makeRepository } from '../src/sync/repository';

const posts = makeRepository('posts', schema.posts);
const albums = makeRepository('albums', schema.albums);
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
const post = (id: string, over: Partial<PostRecord>) => makePostRecord({ id, createdAt: Number(id.slice(1)), ...over });

describe('postsRepository', () => {
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

  it("leaves a thread's following posts out of the newest repost date, unless their first post is deleted", async () => {
    const db = makeTestDb();
    await posts.createMany(db, [
      post('p1', { suggestRepostAt: 50 }),
      post('p2', { suggestRepostAt: 90, threadRootId: 'p1', threadIndex: 1 }),
    ]);
    expect(await readNewestRepostDate(db)).toBe(50);
    await posts.remove(db, ['p1']);
    expect(await readNewestRepostDate(db)).toBe(90);
  });

  describe('readMentionTexts', () => {
    const texts = async (db: SyncDb, assetIds: string[]) =>
      (await readMentionTexts(db, assetIds)).map((row) => row.text);
    // A post with one chip, on `assetIds`.
    const chipPost = (db: SyncDb, over: Partial<PostRecord>, assetIds: string[]) =>
      createPost(db, { mentions: [{ contactId: 'sam', location: 0, name: 'Sam' }], ...over }, assetIds);

    // Album "walks" holds a1 (the draft's photo) and a2; a3 is in no album.
    async function library() {
      const db = makeTestDb();
      await assets.createMany(
        db,
        ['a1', 'a2', 'a3', 'a4'].map((id) => makeAssetRecord({ id })),
      );
      await albums.createMany(db, [makeAlbumRecord({ id: 'walks' }), makeAlbumRecord({ id: 'gone', deletedAt: 5 })]);
      await albumEdges.add(db, 'walks', ['a1', 'a2'], randomUUID);
      await albumEdges.add(db, 'gone', ['a1', 'a4'], randomUUID);
      return db;
    }

    it("reads the posts with chips of the assets' albums, newest first", async () => {
      const db = await library();
      await chipPost(db, { id: 'p1', text: 'Sam, older', postedAt: 10 }, ['a2']);
      await chipPost(db, { id: 'p2', text: 'Sam, newer', postedAt: 20 }, ['a1']);
      await createPost(db, { id: 'p6', text: 'no chip, with @ridge', postedAt: 25 }, ['a1']);
      await chipPost(db, { id: 'p3', text: 'not in the album', postedAt: 30 }, ['a3']);
      await chipPost(db, { id: 'p4', text: 'deleted', postedAt: 40, deletedAt: 41 }, ['a2']);
      await chipPost(db, { id: 'p5', text: 'only in a deleted album', postedAt: 50 }, ['a4']);
      expect(await texts(db, ['a1'])).toEqual(['Sam, newer', 'Sam, older']);
    });

    it('skips a post whose edge to the album asset was removed, and an asset taken out of the album', async () => {
      const db = await library();
      await chipPost(db, { id: 'p1', text: 'edge removed', postedAt: 10 }, ['a2']);
      await db.update(schema.postAssets).set({ deletedAt: 5 });
      await chipPost(db, { id: 'p2', text: 'asset left the album', postedAt: 20 }, ['a1']);
      await db.update(schema.albumAssets).set({ deletedAt: 5 });
      expect(await texts(db, ['a1'])).toEqual([]);
    });

    it('finds a chip post behind more newer posts without chips than it reads', async () => {
      const db = await library();
      await chipPost(db, { id: 'p0', text: 'Sam, long ago', postedAt: 1 }, ['a2']);
      // MENTION_POSTS newer posts without a chip.
      for (let i = 1; i <= 100; i++) await createPost(db, { id: `p${i}`, text: 'no chip', postedAt: 10 + i }, ['a2']);
      expect(await texts(db, ['a1'])).toEqual(['Sam, long ago']);
    });

    it("reads no posts without an album posted from: the library's others are about other people", async () => {
      const db = await library();
      await chipPost(db, { id: 'p1', text: 'with @other', postedAt: 10 }, ['a3']);
      await chipPost(db, { id: 'p2', text: 'with @someone', postedAt: 20 }, []);
      expect(await texts(db, ['a3'])).toEqual([]);
      expect(await texts(db, ['a1'])).toEqual([]);
      expect(await texts(db, [])).toEqual([]);
    });
  });
});
