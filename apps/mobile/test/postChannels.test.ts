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
  repairVersionChannels,
  saveChannelPosts,
  setPostPostedAt,
  type ChannelPart,
} from '../src/sync/postChannels';
import { readThreadPosts } from '../src/sync/postThreads';
import readPost from '../src/sync/queries/readPost';
import { makeRepository } from '../src/sync/repository';
import versionChannelFields from '../src/sync/versionChannelFields';

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
const outboxCount = async () => (await db.select().from(schema.outbox)).length;
const channelIdsOf = async (postId = 'p1') => {
  const post = (await readPost(db, postId))!;
  return [post.channelIds, ...post.channelPosts.map((copy) => copy.channelIds)];
};
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
      channelIds: ['onlyfans'],
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
          channelIds: ['onlyfans'],
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
    const c2: ChannelPart = { id: 'c2', channelIds: ['bluesky'], text: 'sky', assetRefs: [], threadPosts: [] };
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

  it('stores a version of several channels as its first channel and the others, and reads them back as one list', async () => {
    await posts.create(db, makePostRecord({ id: 'p1', channelId: 'onlyfans' }));
    await save([{ id: null, channelIds: ['bluesky', 'x'], text: 'sky', assetRefs: [], threadPosts: [] }], []);
    const [copy] = await readChannelPosts(db, ['p1']);
    expect([copy!.channelId, copy!.extraChannelIds]).toEqual(['bluesky', ['x']]);
    expect(await channelIdsOf()).toEqual([['onlyfans'], ['bluesky', 'x']]);
  });

  it('stores a one-channel version with no extras, and a version without a channel with neither', () => {
    expect(versionChannelFields(['x'])).toEqual({ channelId: 'x', extraChannelIds: null });
    expect(versionChannelFields([])).toEqual({ channelId: null, extraChannelIds: null });
  });

  it('saving a one-channel version over a row without others writes nothing', async () => {
    const seed = await seedPost();
    const before = await outboxCount();
    await save(seed, seed);
    expect(await outboxCount()).toBe(before);
    expect((await row('c1')).extraChannelIds).toBeNull();
  });

  it("reads past another version's channel, which stays on that version", async () => {
    await createPost(db, { id: 'p1', channelId: 'bluesky', extraChannelIds: ['x', 'threads'] });
    await createPost(db, { id: 'c1', channelId: 'x', channelRootId: 'p1' });
    expect(await channelIdsOf()).toEqual([['bluesky', 'threads'], ['x']]);
  });

  it('reads a channel two versions list among their others on the first only', async () => {
    await createPost(db, { id: 'p1', channelId: 'bluesky', extraChannelIds: ['x'] });
    await createPost(db, { id: 'c1', channelId: 'onlyfans', channelRootId: 'p1', extraChannelIds: ['x', 'patreon'] });
    expect(await channelIdsOf()).toEqual([
      ['bluesky', 'x'],
      ['onlyfans', 'patreon'],
    ]);
  });

  it("reads a version's own channel among its others once", async () => {
    await createPost(db, { id: 'p1', channelId: 'bluesky', extraChannelIds: ['bluesky', 'x', 'x'] });
    expect(await channelIdsOf()).toEqual([['bluesky', 'x']]);
  });

  it("writes away another channel the read hid, so it doesn't come back once the version holding it goes", async () => {
    // An installed build added an X version while the shared one still stores X among its others.
    await createPost(db, { id: 'p1', channelId: 'onlyfans' });
    await createPost(db, { id: 'c1', channelId: 'bluesky', channelRootId: 'p1', text: 'sky', extraChannelIds: ['x'] });
    await createPost(db, { id: 'c2', channelId: 'x', channelRootId: 'p1', text: 'x' });
    const seed = (await readPost(db, 'p1'))!.channelPosts.map(({ id, channelIds, text }): ChannelPart => ({
      id,
      channelIds,
      text,
      assetRefs: [],
      threadPosts: [],
    }));
    expect(seed.map((part) => part.channelIds)).toEqual([['bluesky'], ['x']]);
    // The X version removed, saved as updatePost saves: the repair first, then the versions.
    await db.transaction((tx) => repairVersionChannels(tx, 'p1'));
    expect((await row('c1')).extraChannelIds).toBeNull();
    await save([seed[0]!], seed);
    expect(await channelIdsOf()).toEqual([['onlyfans'], ['bluesky']]);
  });

  it('leaves out of a repost a channel another version holds', async () => {
    await createPost(db, { id: 'p1', channelId: 'bluesky', extraChannelIds: ['x'] });
    await createPost(db, { id: 'c1', channelId: 'x', channelRootId: 'p1' });
    const post = await readPost(db, 'p1', { withChannels: false });
    expect([post!.channelIds, post!.channelPosts]).toEqual([['bluesky'], []]);
  });

  it('refuses a version that lists a channel twice', () => {
    expect(() => versionChannelFields(['x', 'bluesky', 'x'])).toThrow();
  });
});
