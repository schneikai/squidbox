import { channelById, postCopyCollection } from '@squidbox/shared';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createThread, makeAssetRecord, makePostRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as assets from '../src/sync/assetsRepository';
import { addChannel, removeChannel } from '../src/sync/channelsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import {
  copyIdOf,
  createCopy,
  removeCopies,
  restoreCopies,
  setCopiesSent,
  updateCopyPosts,
  discardCopyEdits,
} from '../src/sync/postCopiesRepository';
import { removeThreads } from '../src/sync/postThreads';
import readChannelCopies, { type ChannelCopy } from '../src/sync/queries/readChannelCopies';
import readPostCopies, { countPostCopies } from '../src/sync/queries/readPostCopies';
import readRepostCopies from '../src/sync/queries/readRepostCopies';
import { makeRepository } from '../src/sync/repository';
import newRecord from '../src/utils/newRecord';

// Writes the posts and copies a test starts from, as another device's sync would.
const posts = makeRepository('posts', schema.posts);
const copiesRepository = makeRepository('post_copies', schema.postCopies);
const P1 = randomUUID();
const [A1, A2, A3] = [randomUUID(), randomUUID(), randomUUID()];
const ridge = { text: 'Ridge at dawn', mentions: null, assetIds: [] };

const read = (db: SyncDb) => readPostCopies(db, P1);
const texts = (copy: Pick<ChannelCopy, 'posts'>) => copy.posts.map((post) => post.text);
const rows = (db: SyncDb) => db.select().from(schema.postCopies);

async function setup() {
  const db = makeTestDb();
  await posts.create(db, makePostRecord({ id: P1 }));
  await db.transaction((tx) => createCopy(tx, { postId: P1, channelId: 'bluesky', posts: [ridge] }));
  const [copy] = await read(db);
  return { db, copy: copy! };
}

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
const cards = async (db: SyncDb, postId = P1) => (await readChannelCopies(db, postId))!.copies;
const card = async (db: SyncDb, channelId: string) => (await cards(db)).find((copy) => copy.channelId === channelId)!;
const editPost = (db: SyncDb, text: string) => posts.update(db, P1, { text });
const saveAs = (db: SyncDb, channelId: string, text: string) =>
  db.transaction(async (tx) => updateCopyPosts(tx, await card(tx, channelId), [{ ...ridge, text }]));

describe('postCopiesRepository', () => {
  it("stores a repost's copy unsent under its fixed id, and saves its edited posts", async () => {
    const { db, copy } = await setup();
    expect(copy).toMatchObject({ id: copyIdOf(P1, 'bluesky'), channelId: 'bluesky', sentAt: null, followsPost: false });
    const thread = [ridge, { text: 'More from the trail', mentions: null, assetIds: [] }];
    await db.transaction((tx) => updateCopyPosts(tx, copy, thread));
    expect(texts((await read(db))[0]!)).toEqual(['Ridge at dawn', 'More from the trail']);
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

  it("gives a post's copy for a channel one fixed id, the same on every device", () => {
    expect(copyIdOf('5f0c2a5e-8a4e-4d0b-9a57-0d1f3c6f2b11', 'bluesky')).toBe('e5b620f0-f378-5e17-be78-1df72a9519e3');
  });
});

describe('readChannelCopies', () => {
  it("has a card for each of the user's channels, in their order, filled from the post and its thread, with nothing stored", async () => {
    const db = await setupCards();
    const shown = await cards(db);
    expect(shown.map((copy) => copy.channel.id)).toEqual(['bluesky', 'x', 'instagram']);
    for (const copy of shown) {
      expect(copy).toMatchObject({ id: copyIdOf(P1, copy.channelId), sentAt: null, showsPost: true });
      expect(texts(copy)).toEqual(['Ridge at dawn', 'More from the trail']);
      expect(copy.posts.map((post) => post.assetIds)).toEqual([[A1], [A2]]);
    }
    expect(await rows(db)).toEqual([]);
  });

  it("shows the post's new text on an untouched card after the post is edited, and keeps a saved card's own", async () => {
    const db = await setupCards();
    await saveAs(db, 'bluesky', 'Just for Bluesky');
    await editPost(db, 'Ridge at noon');
    expect(texts(await card(db, 'bluesky'))).toEqual(['Just for Bluesky']);
    expect(texts(await card(db, 'x'))).toEqual(['Ridge at noon', 'More from the trail']);
  });

  it('lets a saved card follow the post again once its changes are discarded', async () => {
    const db = await setupCards();
    await saveAs(db, 'x', 'For X');
    await db.transaction(async (tx) => discardCopyEdits(tx, await card(tx, 'x')));
    await editPost(db, 'Ridge at noon');
    expect(await card(db, 'x')).toMatchObject({ showsPost: true });
    expect(texts(await card(db, 'x'))).toEqual(['Ridge at noon', 'More from the trail']);
  });

  it("stores an untouched card's saved edit as the channel's own copy, under its fixed id", async () => {
    const db = await setupCards();
    await saveAs(db, 'x', 'For X');
    expect(await rows(db)).toMatchObject([{ id: copyIdOf(P1, 'x'), channelId: 'x', posts: [{ text: 'For X' }] }]);
    expect((await rows(db))[0]!.followsPost).toBe(false);
    expect(await card(db, 'x')).toMatchObject({ showsPost: false, posts: [{ text: 'For X' }] });
  });

  it('stores the cards Send all marks sent with the posts they showed, and keeps showing them after the post is edited', async () => {
    const db = await setupCards();
    await saveAs(db, 'x', 'For X');
    await db.transaction(async (tx) => setCopiesSent(tx, await cards(tx), 50));
    await editPost(db, 'Ridge at noon');
    expect((await cards(db)).map((copy) => [copy.channelId, copy.sentAt, copy.showsPost, texts(copy)[0]])).toEqual([
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

  it('lets a copy never saved follow the post again once it is marked as not sent', async () => {
    const db = await setupCards();
    await db.transaction(async (tx) => setCopiesSent(tx, [await card(tx, 'x')], 50));
    await db.transaction(async (tx) => setCopiesSent(tx, [await card(tx, 'x')], null));
    await editPost(db, 'Ridge at noon');
    expect(await card(db, 'x')).toMatchObject({ sentAt: null, showsPost: true });
    expect(texts(await card(db, 'x'))).toEqual(['Ridge at noon', 'More from the trail']);
  });

  it('keeps a removed card away after the post is edited, until + brings it back, following the post unless it was saved', async () => {
    const db = await setupCards();
    await saveAs(db, 'bluesky', 'Just for Bluesky');
    await db.transaction(async (tx) => removeCopies(tx, [await card(tx, 'x'), await card(tx, 'bluesky')]));
    await editPost(db, 'Ridge at noon');
    const removed = (await readChannelCopies(db, P1))!;
    expect(removed.addable.map((channel) => channel.id)).toEqual(['bluesky', 'x']);
    expect(removed.copies.map((copy) => copy.channelId)).toEqual(['instagram']);

    for (const channelId of ['x', 'bluesky']) await db.transaction((tx) => restoreCopies(tx, P1, channelId));
    expect(await card(db, 'x')).toMatchObject({ id: copyIdOf(P1, 'x'), sentAt: null, showsPost: true });
    expect(texts(await card(db, 'x'))).toEqual(['Ridge at noon', 'More from the trail']);
    expect(texts(await card(db, 'bluesky'))).toEqual(['Just for Bluesky']);
    expect((await readChannelCopies(db, P1))!.addable).toEqual([]);
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
      await expect(db.transaction(write)).rejects.toThrow('This copy was removed');
    expect(await rows(db)).toMatchObject([{ id: x.id, sentAt: null, followsPost: true }]);
    expect((await rows(db))[0]!.removedAt).not.toBeNull();
  });

  it("drops the cards that follow the post of a channel taken out of the user's channels, and keeps its saved and its sent copy", async () => {
    const db = await setupCards();
    const P2 = randomUUID();
    const P3 = randomUUID();
    for (const id of [P2, P3]) await posts.create(db, makePostRecord({ id, text: 'Coffee' }));
    await saveAs(db, 'x', 'For X');
    await db.transaction(async (tx) => setCopiesSent(tx, [(await cards(tx, P2))[1]!], 50));
    await db.transaction(async (tx) => setCopiesSent(tx, [(await cards(tx, P3))[1]!], 50));
    await db.transaction(async (tx) => setCopiesSent(tx, [(await cards(tx, P3))[1]!], null));
    await removeChannel(db, channelById('x')!);
    const channelsOf = async (postId: typeof P1) => (await cards(db, postId)).map((copy) => copy.channelId);
    expect(await channelsOf(P1)).toEqual(['bluesky', 'instagram', 'x']);
    expect(await channelsOf(P2)).toEqual(['bluesky', 'instagram', 'x']);
    expect(await channelsOf(P3)).toEqual(['bluesky', 'instagram']);
  });

  it('shows two cards for two random-id copies of one channel, and no untouched one', async () => {
    const db = await setupCards();
    const stored = [1, 2].map((createdAt) =>
      newRecord(postCopyCollection, {}, { postId: P1, channelId: 'x', posts: [ridge], sentAt: 5, createdAt }),
    );
    await copiesRepository.createMany(db, stored);
    expect((await cards(db)).map((copy) => [copy.channelId, copy.id])).toEqual([
      ['bluesky', copyIdOf(P1, 'bluesky')],
      ['x', stored[0]!.id],
      ['x', stored[1]!.id],
      ['instagram', copyIdOf(P1, 'instagram')],
    ]);
  });

  it("shows an untouched card for a deleted copy under the card's fixed id, and stores the card there again", async () => {
    const db = await setupCards();
    const x = await card(db, 'x');
    await db.transaction((tx) => setCopiesSent(tx, [x], 50));
    await copiesRepository.remove(db, [x.id]);
    expect(await card(db, 'x')).toMatchObject({ id: x.id, sentAt: null, showsPost: true });
    await db.transaction(async (tx) => setCopiesSent(tx, [await card(tx, 'x')], 60));
    expect(await rows(db)).toMatchObject([{ id: x.id, sentAt: 60, deletedAt: null }]);
  });

  it("shows a copy written without followsPost (an older build's) as the channel's own", async () => {
    const db = await setupCards();
    const record = newRecord(postCopyCollection, {}, { postId: P1, channelId: 'x', posts: [ridge], sentAt: null });
    await copiesRepository.create(db, record);
    expect(await card(db, 'x')).toMatchObject({ id: record.id, showsPost: false, posts: [{ text: 'Ridge at dawn' }] });
  });

  it('refuses a write on a card of a deleted post, and on a stored copy deleted meanwhile', async () => {
    const db = await setupCards();
    const record = newRecord(postCopyCollection, {}, { postId: P1, channelId: 'x', posts: [ridge], sentAt: null });
    await copiesRepository.create(db, record);
    const [bluesky, x] = await cards(db);
    await copiesRepository.remove(db, [record.id]);
    await expect(db.transaction((tx) => setCopiesSent(tx, [x!], 50))).rejects.toThrow('This copy was removed');
    await db.transaction((tx) => removeThreads(tx, [P1]));
    await expect(db.transaction((tx) => updateCopyPosts(tx, bluesky!, [ridge]))).rejects.toThrow(
      'This post was deleted',
    );
    expect((await rows(db)).filter((row) => row.deletedAt === null)).toEqual([]);
  });

  it('reads nothing for a deleted post', async () => {
    const db = await setupCards();
    await db.transaction((tx) => removeThreads(tx, [P1]));
    expect(await readChannelCopies(db, P1)).toBeNull();
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

describe('readRepostCopies', () => {
  it("starts a repost with the post's own copies, sent or not, and not with removed ones or those that show the post", async () => {
    const db = await setupCards();
    await saveAs(db, 'bluesky', 'Just for Bluesky');
    await db.transaction(async (tx) => setCopiesSent(tx, [await card(tx, 'bluesky'), await card(tx, 'x')], 50));
    await saveAs(db, 'instagram', 'Just for Instagram');
    await db.transaction(async (tx) => removeCopies(tx, [await card(tx, 'instagram')]));
    expect(await readRepostCopies(db, P1)).toEqual([
      { channelId: 'bluesky', posts: [{ text: 'Just for Bluesky', mentions: null, assetIds: [] }] },
    ]);
  });
});

describe('countPostCopies', () => {
  it("counts the copies that hold something of the user's: sent or own, not removed", async () => {
    const db = await setupCards();
    await saveAs(db, 'bluesky', 'Just for Bluesky');
    await db.transaction(async (tx) => setCopiesSent(tx, [await card(tx, 'x')], 50));
    await db.transaction(async (tx) => setCopiesSent(tx, [await card(tx, 'x')], null));
    await db.transaction(async (tx) => removeCopies(tx, [await card(tx, 'instagram')]));
    expect(await countPostCopies(db, P1)).toBe(1);
  });
});
