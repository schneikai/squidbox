import type { PostRecord } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { createPost, createThread, makePostRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { readThreadPosts, removeThread, saveThreadPosts, setThreadPostedAt } from '../src/sync/postThreads';
import { makeRepository } from '../src/sync/repository';

const posts = makeRepository('posts', schema.posts);

let db: SyncDb;
let n: number;
const newId = () => `id-${++n}`;
beforeEach(() => {
  db = makeTestDb();
  n = 0;
});

const newPart = (fields: Partial<PostRecord>) => makePostRecord({ id: newId(), ...fields });
const save = (
  parts: Parameters<typeof saveThreadPosts>[2],
  seed: Parameters<typeof saveThreadPosts>[3],
  postedAt = 50,
) => db.transaction((tx) => saveThreadPosts(tx, 't1', parts, seed, { postedAt, newPart }));
const row = async (id: string) => (await db.select().from(schema.posts).where(eq(schema.posts.id, id)))[0]!;
const edgesOf = async (postId: string) =>
  (await db.select().from(schema.postAssets).where(eq(schema.postAssets.postId, postId))).map((edge) => ({
    assetId: edge.assetId,
    live: edge.deletedAt === null,
  }));
const live = async () => (await readThreadPosts(db, ['t1'])).map((post) => [post.id, post.threadIndex, post.text]);

// The seed of a thread as the editor reads it: t1 with t1-1 (a1) and t1-2 (a2).
async function seedThread() {
  await createThread(
    db,
    { id: 't1', postedAt: 50 },
    [
      { id: 't1-1', text: 'one', assetIds: ['a1'] },
      { id: 't1-2', text: 'two', assetIds: ['a2'] },
    ],
    newId,
  );
  const edgeIdOf = async (postId: string) =>
    (await db.select().from(schema.postAssets).where(eq(schema.postAssets.postId, postId)))[0]!.id;
  return [
    { id: 't1-1', text: 'one', assetRefs: [{ id: await edgeIdOf('t1-1'), assetId: 'a1' }] },
    { id: 't1-2', text: 'two', assetRefs: [{ id: await edgeIdOf('t1-2'), assetId: 'a2' }] },
  ];
}

describe('postThreads', () => {
  it("adds the following posts with the first post's Posted time, indexes 1..n and their edges", async () => {
    await posts.create(db, makePostRecord({ id: 't1', postedAt: 50 }));
    await save(
      [
        { id: null, text: 'one', assetRefs: [{ id: 'e1', assetId: 'a1' }] },
        { id: null, text: 'two', assetRefs: [] },
      ],
      [],
    );
    const parts = await readThreadPosts(db, ['t1']);
    expect(parts.map((part) => [part.text, part.threadIndex, part.postedAt, part.threadRootId])).toEqual([
      ['one', 1, 50, 't1'],
      ['two', 2, 50, 't1'],
    ]);
    expect(await edgesOf(parts[0]!.id)).toEqual([{ assetId: 'a1', live: true }]);
  });

  it('saves a changed text and changed photos of a following post', async () => {
    const seed = await seedThread();
    await save(
      [
        { ...seed[0]!, text: 'one, edited' },
        { ...seed[1]!, assetRefs: [...seed[1]!.assetRefs, { id: 'e-new', assetId: 'a3' }] },
      ],
      seed,
    );
    expect(await live()).toEqual([
      ['t1-1', 1, 'one, edited'],
      ['t1-2', 2, 'two'],
    ]);
    expect(await edgesOf('t1-2')).toEqual([
      { assetId: 'a2', live: true },
      { assetId: 'a3', live: true },
    ]);
  });

  it("creates a new following post after the thread's last", async () => {
    const seed = await seedThread();
    await save([seed[1]!, { id: null, text: 'three', assetRefs: [] }], [seed[1]!]);
    expect((await live()).at(-1)).toEqual(['id-3', 3, 'three']);
  });

  it('removes a following post the list no longer has, with its edges; its photo keeps its edges elsewhere', async () => {
    const seed = await seedThread();
    await createPost(db, { id: 'p2' }, ['a1'], newId);
    await save([seed[1]!], seed);
    expect(await live()).toEqual([['t1-2', 2, 'two']]);
    expect((await row('t1-1')).deletedAt).not.toBeNull();
    expect(await edgesOf('t1-1')).toEqual([{ assetId: 'a1', live: false }]);
    expect(await edgesOf('p2')).toEqual([{ assetId: 'a1', live: true }]);
  });

  it('leaves a following post deleted meanwhile as it is', async () => {
    const seed = await seedThread();
    await db.transaction((tx) => removeThread(tx, 't1-1')); // another device deleted it
    await save([{ ...seed[0]!, text: 'edited', assetRefs: [{ id: 'e-new', assetId: 'a3' }] }, seed[1]!], seed);
    expect((await row('t1-1')).text).toBe('one');
    expect(await edgesOf('t1-1')).toEqual([{ assetId: 'a1', live: false }]);
  });

  it("gives the following posts the first post's Posted time, null included", async () => {
    await seedThread();
    await db.transaction((tx) => setThreadPostedAt(tx, 't1', 70));
    expect((await readThreadPosts(db, ['t1'])).map((post) => post.postedAt)).toEqual([70, 70]);
    await db.transaction((tx) => setThreadPostedAt(tx, 't1', null));
    expect((await readThreadPosts(db, ['t1'])).map((post) => post.postedAt)).toEqual([null, null]);
  });

  it('deletes a thread as tombstones of the first post, its following posts and all their edges', async () => {
    await seedThread();
    await db.transaction((tx) => removeThread(tx, 't1'));
    const rows = await db.select().from(schema.posts);
    expect(rows.map((post) => [post.id, post.deletedAt !== null])).toEqual([
      ['t1', true],
      ['t1-1', true],
      ['t1-2', true],
    ]);
    const edges = await db.select().from(schema.postAssets);
    expect(edges).toHaveLength(2);
    expect(edges.every((edge) => edge.deletedAt !== null)).toBe(true);
  });
});
