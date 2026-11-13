import type { PostRecord } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createPost, createThread, makePostRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import {
  readChannelPosts,
  removePost,
  saveChannelPosts,
  setPostPostedAt,
  type ChannelPart,
} from '../src/sync/postChannels';
import { readThreadPosts } from '../src/sync/postThreads';
import { makeRepository } from '../src/sync/repository';

const posts = makeRepository('posts', schema.posts);

let db: SyncDb;
let n: number;
const newId = () => `id-${++n}`;
beforeEach(() => {
  db = makeTestDb();
  n = 0;
});

const newPost = (fields: Partial<PostRecord>) => makePostRecord({ id: newId(), ...fields });
const save = (parts: ChannelPart[], seed: ChannelPart[]) =>
  db.transaction((tx) => saveChannelPosts(tx, 'p1', parts, seed, newPost));
const row = async (id: string) => (await db.select().from(schema.posts).where(eq(schema.posts.id, id)))[0]!;
const liveEdges = async (postId: string) =>
  (await db.select().from(schema.postAssets).where(eq(schema.postAssets.postId, postId)))
    .filter((edge) => edge.deletedAt === null)
    .map((edge) => edge.assetId);
const edgeIdOf = async (postId: string) =>
  (await db.select().from(schema.postAssets).where(eq(schema.postAssets.postId, postId)))[0]!.id;

// p1 on X (a1), with c1: OnlyFans (a1, a2) whose thread is c1-1 (a3).
async function seedPost(): Promise<ChannelPart[]> {
  await createPost(db, { id: 'p1', postedAt: 50, channelId: 'x' }, ['a1'], newId);
  await createThread(
    db,
    { id: 'c1', postedAt: 50, channelId: 'onlyfans', channelRootId: 'p1', text: 'full video', assetIds: ['a1'] },
    [{ id: 'c1-1', text: 'more', assetIds: ['a3'] }],
    newId,
  );
  return [
    {
      id: 'c1',
      channelId: 'onlyfans',
      text: 'full video',
      assetRefs: [{ id: await edgeIdOf('c1'), assetId: 'a1' }],
      threadPosts: [{ id: 'c1-1', text: 'more', assetRefs: [{ id: await edgeIdOf('c1-1'), assetId: 'a3' }] }],
    },
  ];
}

describe('postChannels', () => {
  it("saves a post's new channel as a post of its own, with its own edges and thread", async () => {
    await posts.create(db, makePostRecord({ id: 'p1', postedAt: 50, channelId: 'x' }));
    await save(
      [
        {
          id: null,
          channelId: 'onlyfans',
          text: 'on OnlyFans',
          assetRefs: [{ id: 'e1', assetId: 'a1' }],
          threadPosts: [{ id: null, text: 'and more', assetRefs: [] }],
        },
      ],
      [],
    );
    const [copy] = await readChannelPosts(db, ['p1']);
    expect([copy!.channelId, copy!.channelRootId, copy!.text, copy!.postedAt]).toEqual([
      'onlyfans',
      'p1',
      'on OnlyFans',
      50,
    ]);
    expect(await liveEdges(copy!.id)).toEqual(['a1']);
    expect((await readThreadPosts(db, [copy!.id])).map((part) => part.text)).toEqual(['and more']);
  });

  it('writes only the channel that was edited', async () => {
    const seed = await seedPost();
    await createPost(db, { id: 'c2', channelId: 'bluesky', channelRootId: 'p1', text: 'sky' }, [], newId);
    const c2: ChannelPart = { id: 'c2', channelId: 'bluesky', text: 'sky', assetRefs: [], threadPosts: [] };
    const before = await row('c1');
    await save([seed[0]!, { ...c2, text: 'sky, edited' }], [...seed, c2]);
    expect(await row('c1')).toEqual(before);
    expect((await row('c2')).text).toBe('sky, edited');
  });

  it('removes a channel with its thread and their edges', async () => {
    const seed = await seedPost();
    await save([], seed);
    expect(await readChannelPosts(db, ['p1'])).toEqual([]);
    expect((await row('c1')).deletedAt).not.toBeNull();
    expect((await row('c1-1')).deletedAt).not.toBeNull();
    expect(await liveEdges('c1')).toEqual([]);
    expect(await liveEdges('c1-1')).toEqual([]);
  });

  it('deletes the post on every channel', async () => {
    await seedPost();
    await db.transaction((tx) => removePost(tx, 'p1'));
    for (const id of ['p1', 'c1', 'c1-1']) expect((await row(id)).deletedAt, id).not.toBeNull();
    expect(await liveEdges('p1')).toEqual([]);
  });

  it('gives every channel and thread a changed Posted time', async () => {
    await seedPost();
    await db.transaction((tx) => setPostPostedAt(tx, 'p1', 90));
    for (const id of ['c1', 'c1-1']) expect((await row(id)).postedAt, id).toBe(90);
  });
});
