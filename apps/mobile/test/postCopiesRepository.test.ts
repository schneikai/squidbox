import { channelById, postCopyCollection } from '@squidbox/shared';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createThread, makeAssetRecord, makePostRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import uuidV5 from '../src/lib/uuidV5';
import * as assets from '../src/sync/assetsRepository';
import { addChannel, removeChannel } from '../src/sync/channelsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import {
  addCopyFromPost,
  copyIdOf,
  createCopy,
  removeCopies,
  setCopiesSent,
  updateCopyPosts,
} from '../src/sync/postCopiesRepository';
import { removeThreads } from '../src/sync/postThreads';
import readChannelCopies, { type ChannelCopy } from '../src/sync/queries/readChannelCopies';
import readPost from '../src/sync/queries/readPost';
import readPostCopies from '../src/sync/queries/readPostCopies';
import { makeRepository } from '../src/sync/repository';
import newRecord from '../src/utils/newRecord';
import isCopyOfPost from '../src/utils/posts/isCopyOfPost';

const posts = makeRepository('posts', schema.posts);
const copiesRepository = makeRepository('post_copies', schema.postCopies);
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

// A post and its thread with a picture each, and the user's channels Bluesky, X and Instagram.
async function setupCards() {
  const db = makeTestDb();
  await assets.createMany(db, [makeAssetRecord({ id: A1 }), makeAssetRecord({ id: A2 })]);
  await createThread(db, { id: P1, text: 'Ridge at dawn', assetIds: [A1] }, [
    { text: 'More from the trail', assetIds: [A2] },
  ]);
  for (const id of ['bluesky', 'x', 'instagram']) await addChannel(db, channelById(id)!);
  return db;
}
const cards = async (db: SyncDb) => (await readChannelCopies(db, P1)).copies;
const card = async (db: SyncDb, channelId: string) => (await cards(db)).find((copy) => copy.channelId === channelId)!;
const texts = (copy: ChannelCopy) => copy.posts.map((post) => post.text);
const rows = (db: SyncDb) => db.select().from(schema.postCopies);
const editPost = (db: SyncDb, text: string) => posts.update(db, P1, { text });

describe('postCopiesRepository', () => {
  it('creates a copy unsent, and saves its edited posts', async () => {
    const { db, copy } = await setup();
    expect(await read(db)).toMatchObject([{ id: copy.id, channelId: 'bluesky', sentAt: null }]);
    const thread = [ridge, { text: 'More from the trail', mentions: null, assetIds: [] }];
    await db.transaction((tx) => updateCopyPosts(tx, copy, thread));
    expect((await read(db))[0]!.posts.map((post) => post.text)).toEqual(['Ridge at dawn', 'More from the trail']);
  });

  it('lists copies made together in the order of their createdAt', async () => {
    const { db } = await setup();
    await db.transaction(async (tx) => {
      await createCopy(tx, { postId: P1, channelId: 'x', posts: [ridge], createdAt: 2 });
      await createCopy(tx, { postId: P1, channelId: 'instagram', posts: [ridge], createdAt: 1 });
    });
    expect((await read(db)).map((copy) => copy.channelId)).toEqual(['instagram', 'x', 'bluesky']);
  });

  it('refuses to edit a sent copy, until it is marked as not sent', async () => {
    const { db, copy } = await setup();
    await db.transaction((tx) => setCopiesSent(tx, [copy], 50));
    expect((await read(db))[0]!.sentAt).toBe(50);
    await expect(db.transaction((tx) => updateCopyPosts(tx, copy, [ridge]))).rejects.toThrow('sent');
    await db.transaction((tx) => setCopiesSent(tx, [copy], null));
    await db.transaction((tx) => updateCopyPosts(tx, copy, [{ ...ridge, text: 'Edited' }]));
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

  it("gives a post's copy for a channel the RFC 4122 uuid v5 of both, the same on every device", () => {
    const dns = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    expect(uuidV5('hello.example.com', dns)).toBe('fdda765f-fc57-5604-a269-52a7df8164ec');
    expect(copyIdOf('5f0c2a5e-8a4e-4d0b-9a57-0d1f3c6f2b11', 'bluesky')).toBe('e5b620f0-f378-5e17-be78-1df72a9519e3');
  });
});

describe('readChannelCopies', () => {
  it("has a card for each of the user's channels, in their order, filled from the post and its thread, with nothing stored", async () => {
    const db = await setupCards();
    const shown = await cards(db);
    expect(shown.map((copy) => copy.channelId)).toEqual(['bluesky', 'x', 'instagram']);
    for (const copy of shown) {
      expect(copy).toMatchObject({ id: copyIdOf(P1, copy.channelId), sentAt: null, followsPost: true });
      expect(texts(copy)).toEqual(['Ridge at dawn', 'More from the trail']);
      expect(copy.posts.map((post) => post.assetIds)).toEqual([[A1], [A2]]);
    }
    expect(await rows(db)).toEqual([]);
  });

  it("shows the post's new text on an untouched card after the post is edited, and keeps a saved card's own", async () => {
    const db = await setupCards();
    const bluesky = await card(db, 'bluesky');
    await db.transaction((tx) => updateCopyPosts(tx, bluesky, [{ ...ridge, text: 'Just for Bluesky' }]));
    await editPost(db, 'Ridge at noon');
    expect(texts(await card(db, 'bluesky'))).toEqual(['Just for Bluesky']);
    expect(texts(await card(db, 'x'))).toEqual(['Ridge at noon', 'More from the trail']);
  });

  it("stores an untouched card's saved edit as the channel's copy, under its fixed id", async () => {
    const db = await setupCards();
    await db.transaction(async (tx) => updateCopyPosts(tx, await card(tx, 'x'), [{ ...ridge, text: 'For X' }]));
    expect(await rows(db)).toMatchObject([{ id: copyIdOf(P1, 'x'), channelId: 'x', posts: [{ text: 'For X' }] }]);
    expect(await card(db, 'x')).toMatchObject({ followsPost: false, posts: [{ text: 'For X' }] });
  });

  it('stores the untouched cards Send all marks sent with the posts they showed, and marks the stored ones', async () => {
    const db = await setupCards();
    await db.transaction(async (tx) => updateCopyPosts(tx, await card(tx, 'x'), [{ ...ridge, text: 'For X' }]));
    await db.transaction(async (tx) => setCopiesSent(tx, await cards(tx), 50));
    const shown = await cards(db);
    expect(shown.map((copy) => [copy.channelId, copy.sentAt, copy.followsPost, texts(copy)[0]])).toEqual([
      ['bluesky', 50, false, 'Ridge at dawn'],
      ['x', 50, false, 'For X'],
      ['instagram', 50, false, 'Ridge at dawn'],
    ]);
    expect((await rows(db)).find((row) => row.channelId === 'bluesky')!.posts).toEqual([
      { text: 'Ridge at dawn', mentions: null, assetIds: [A1] },
      { text: 'More from the trail', mentions: null, assetIds: [A2] },
    ]);
  });

  it('writes one record when the same untouched card is stored twice', async () => {
    const db = await setupCards();
    const bluesky = await card(db, 'bluesky');
    await db.transaction((tx) => setCopiesSent(tx, [bluesky], 50));
    await db.transaction((tx) => setCopiesSent(tx, [bluesky], 60));
    expect(await rows(db)).toMatchObject([{ id: bluesky.id, sentAt: 60 }]);
  });

  it('keeps a removed card away after the post is edited, until + brings it back filled from the post as it is then, unsent', async () => {
    const db = await setupCards();
    const x = await card(db, 'x');
    await db.transaction((tx) => setCopiesSent(tx, [x], 50));
    await db.transaction((tx) => removeCopies(tx, [x]));
    await editPost(db, 'Ridge at noon');
    expect(await readChannelCopies(db, P1)).toMatchObject({ addableChannelIds: ['x'] });
    expect((await cards(db)).map((copy) => copy.channelId)).toEqual(['bluesky', 'instagram']);

    await db.transaction((tx) => addCopyFromPost(tx, P1, 'x'));
    expect(await card(db, 'x')).toMatchObject({ id: x.id, sentAt: null, followsPost: false });
    expect(texts(await card(db, 'x'))).toEqual(['Ridge at noon', 'More from the trail']);
    expect((await readChannelCopies(db, P1)).addableChannelIds).toEqual([]);
  });

  it('refuses to save, send or remove a card removed meanwhile, and leaves it removed', async () => {
    const db = await setupCards();
    const x = await card(db, 'x');
    await db.transaction((tx) => removeCopies(tx, [x]));
    for (const write of [
      (tx: SyncDb) => updateCopyPosts(tx, x, [ridge]),
      (tx: SyncDb) => setCopiesSent(tx, [x], 50),
      (tx: SyncDb) => removeCopies(tx, [x]),
    ])
      await expect(db.transaction(write)).rejects.toThrow('This copy was deleted');
    expect(await rows(db)).toMatchObject([{ id: x.id, sentAt: null }]);
    expect((await rows(db))[0]!.deletedAt).not.toBeNull();
  });

  it("drops the untouched card of a channel taken out of the user's channels, and keeps its edited and its sent copy", async () => {
    const db = await setupCards();
    const P2 = randomUUID();
    await posts.create(db, makePostRecord({ id: P2, text: 'Coffee' }));
    await db.transaction(async (tx) => updateCopyPosts(tx, await card(tx, 'x'), [{ ...ridge, text: 'For X' }]));
    const [, x2] = (await readChannelCopies(db, P2)).copies;
    await db.transaction((tx) => setCopiesSent(tx, [x2!], 50));
    await removeChannel(db, channelById('x')!);
    expect((await cards(db)).map((copy) => [copy.channelId, copy.followsPost])).toEqual([
      ['bluesky', true],
      ['instagram', true],
      ['x', false],
    ]);
    expect((await readChannelCopies(db, P2)).copies.map((copy) => [copy.channelId, copy.sentAt])).toEqual([
      ['bluesky', null],
      ['instagram', null],
      ['x', 50],
    ]);
    await removeChannel(db, channelById('bluesky')!);
    expect((await cards(db)).map((copy) => copy.channelId)).toEqual(['instagram', 'x']);
  });

  it("takes over a copy's fixed id once its record was moved off the post, as the mock data's reset does", async () => {
    const db = await setupCards();
    const x = await card(db, 'x');
    await db.transaction((tx) => removeCopies(tx, [x]));
    await copiesRepository.update(db, x.id, { postId: x.id });
    expect(await card(db, 'x')).toMatchObject({ id: x.id, followsPost: true });
    await db.transaction(async (tx) => setCopiesSent(tx, [await card(tx, 'x')], 50));
    expect(await card(db, 'x')).toMatchObject({ id: x.id, sentAt: 50, followsPost: false });
  });

  it('shows two cards for two random-id copies of one channel, and no untouched one', async () => {
    const db = await setupCards();
    const stored = [1, 2].map((createdAt) =>
      newRecord(postCopyCollection, {}, { postId: P1, channelId: 'x', posts: [ridge], sentAt: null, createdAt }),
    );
    await copiesRepository.createMany(db, stored);
    expect((await cards(db)).map((copy) => [copy.channelId, copy.id])).toEqual([
      ['bluesky', copyIdOf(P1, 'bluesky')],
      ['x', stored[0]!.id],
      ['x', stored[1]!.id],
      ['instagram', copyIdOf(P1, 'instagram')],
    ]);
  });

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

describe('isCopyOfPost', () => {
  it('is true for a copy Send all stored of an untouched card', async () => {
    const db = await setupCards();
    await db.transaction(async (tx) => setCopiesSent(tx, [await card(tx, 'x')], 50));
    expect(isCopyOfPost((await read(db))[0]!, (await readPost(db, P1))!)).toBe(true);
  });

  it('is false for a copy with a changed text, mention, asset or number of posts', async () => {
    const db = await setupCards();
    const post = (await readPost(db, P1))!;
    const [first, second] = (await card(db, 'x')).posts;
    const mention = [{ contactId: randomUUID(), location: 0, name: 'Ridge' }];
    for (const posts of [
      [{ ...first!, text: 'Other' }, second!],
      [{ ...first!, mentions: mention }, second!],
      [{ ...first!, assetIds: [A2!] }, second!],
      [first!],
    ])
      expect(isCopyOfPost({ posts }, post)).toBe(false);
  });
});
