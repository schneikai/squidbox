import type { PostRecord } from '@squidbox/shared';
import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord, makePostRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as assets from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { readMentionedTexts, readMentionTexts, readNewestRepostDate } from '../src/sync/postsRepository';
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

    it("reads the posts of the assets' albums, newest first", async () => {
      const db = await library();
      await createPost(db, { id: 'p1', text: 'older, with @ridge', postedAt: 10 }, ['a2']);
      await createPost(db, { id: 'p2', text: 'newer', postedAt: 20 }, ['a1']);
      await createPost(db, { id: 'p3', text: 'not in the album', postedAt: 30 }, ['a3']);
      await createPost(db, { id: 'p4', text: 'deleted', postedAt: 40, deletedAt: 41 }, ['a2']);
      await createPost(db, { id: 'p5', text: 'only in a deleted album', postedAt: 50 }, ['a4']);
      expect(await readMentionTexts(db, ['a1'])).toEqual({
        texts: ['newer', 'older, with @ridge'],
        fromAlbum: true,
      });
    });

    it('skips a post whose edge to the album asset was removed, and an asset taken out of the album', async () => {
      const db = await library();
      await createPost(db, { id: 'p1', text: 'edge removed', postedAt: 10 }, ['a2']);
      await db.update(schema.postAssets).set({ deletedAt: 5 });
      await createPost(db, { id: 'p2', text: 'asset left the album', postedAt: 20 }, ['a1']);
      await db.update(schema.albumAssets).set({ deletedAt: 5 });
      await createPost(db, { id: 'p3', text: 'newest elsewhere', postedAt: 30 }, ['a3']);
      expect(await readMentionTexts(db, ['a1'])).toEqual({
        texts: ['newest elsewhere', 'asset left the album', 'edge removed'],
        fromAlbum: false,
      });
    });

    it('falls back to the newest live posts without an album or its posts', async () => {
      const db = await library();
      await createPost(db, { id: 'p1', text: 'one', postedAt: 10 }, ['a3']);
      await createPost(db, { id: 'p2', text: 'two', postedAt: 20 });
      await createPost(db, { id: 'p3', text: 'deleted', postedAt: 30, deletedAt: 31 });
      expect(await readMentionTexts(db, ['a3'])).toEqual({ texts: ['two', 'one'], fromAlbum: false });
      expect(await readMentionTexts(db, [])).toEqual({ texts: ['two', 'one'], fromAlbum: false });
    });
  });

  it('reads every live post with an @ for the handles ever mentioned, newest first', async () => {
    const db = makeTestDb();
    await createPost(db, { id: 'p1', text: 'older, @ridge', postedAt: 10 });
    await createPost(db, { id: 'p2', text: 'newer, @trailmike', postedAt: 20 });
    await createPost(db, { id: 'p3', text: 'no handle', postedAt: 30 });
    await createPost(db, { id: 'p4', text: 'deleted @gone', postedAt: 40, deletedAt: 41 });
    expect(await readMentionedTexts(db)).toEqual(['newer, @trailmike', 'older, @ridge']);
  });
});
