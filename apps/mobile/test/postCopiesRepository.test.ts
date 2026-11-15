import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { makeAssetRecord, makePostRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as assets from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { createCopy, setCopiesSent, updateCopyPosts } from '../src/sync/postCopiesRepository';
import { removeThreads } from '../src/sync/postThreads';
import readPostCopies from '../src/sync/queries/readPostCopies';
import { makeRepository } from '../src/sync/repository';

const posts = makeRepository('posts', schema.posts);
const P1 = randomUUID();
const [A1, A2, A3] = [randomUUID(), randomUUID(), randomUUID()];
const ridge = { text: 'Ridge at dawn', mentions: null, assetIds: [] };

async function setup() {
  const db = makeTestDb();
  await posts.create(db, makePostRecord({ id: P1 }));
  const copy = await db.transaction((tx) => createCopy(tx, { postId: P1, channelId: 'bluesky', posts: [ridge] }));
  return { db, copy };
}
const read = (db: SyncDb) => readPostCopies(db, P1);

describe('postCopiesRepository', () => {
  it('creates a copy unsent, and saves its edited posts', async () => {
    const { db, copy } = await setup();
    expect(await read(db)).toMatchObject([{ id: copy.id, channelId: 'bluesky', sentAt: null }]);
    const thread = [ridge, { text: 'More from the trail', mentions: null, assetIds: [] }];
    await db.transaction((tx) => updateCopyPosts(tx, copy.id, thread));
    expect((await read(db))[0]!.posts.map((post) => post.text)).toEqual(['Ridge at dawn', 'More from the trail']);
  });

  it('refuses to edit a sent copy, until it is marked as not sent', async () => {
    const { db, copy } = await setup();
    await db.transaction((tx) => setCopiesSent(tx, [copy.id], 50));
    expect((await read(db))[0]!.sentAt).toBe(50);
    await expect(db.transaction((tx) => updateCopyPosts(tx, copy.id, [ridge]))).rejects.toThrow('sent');
    await db.transaction((tx) => setCopiesSent(tx, [copy.id], null));
    await db.transaction((tx) => updateCopyPosts(tx, copy.id, [{ ...ridge, text: 'Edited' }]));
    expect((await read(db))[0]).toMatchObject({ sentAt: null, posts: [{ text: 'Edited' }] });
  });

  it("removes a post's copies with it", async () => {
    const { db } = await setup();
    await db.transaction((tx) => removeThreads(tx, [P1]));
    expect(await read(db)).toEqual([]);
  });

  it('refuses a copy over its limits, with the schema saying why', async () => {
    const { db } = await setup();
    const many = Array.from({ length: 101 }, () => ridge);
    await expect(db.transaction((tx) => createCopy(tx, { postId: P1, channelId: 'x', posts: many }))).rejects.toThrow(
      'posts',
    );
  });
});

describe('readPostCopies', () => {
  it('leaves out a purged asset, and keeps a trashed one in its place', async () => {
    const db = makeTestDb();
    await assets.createMany(db, [
      makeAssetRecord({ id: A1 }),
      makeAssetRecord({ id: A2, deletedAt: 5, purgedAt: 6 }),
      makeAssetRecord({ id: A3, deletedAt: 5 }),
    ]);
    await posts.create(db, makePostRecord({ id: P1 }));
    const post = { text: '', mentions: null, assetIds: [A1!, A2!, A3!] };
    await db.transaction((tx) => createCopy(tx, { postId: P1, channelId: 'x', posts: [post] }));
    const [shown] = (await read(db))[0]!.posts;
    expect(shown!.assets.map((asset) => asset.id)).toEqual([A1, A3]);
    expect(shown!.assetIds).toEqual([A1, A3]);
  });
});
