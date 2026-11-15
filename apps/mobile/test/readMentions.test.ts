import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { makeMeasuredTestDb, makeTestDb } from './helpers/testDb';
import readMentions from '../src/features/post-chat/readMentions';
import * as assets from '../src/sync/assetsRepository';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { contactLinks } from '../src/sync/membershipRepository';
import { makeRepository } from '../src/sync/repository';

const albums = makeRepository('albums', schema.albums);
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
const tag = (db: ReturnType<typeof makeTestDb>, photoId: string, contactIds: string[]) =>
  contactLinks.add(db, { targetType: 'asset', targetId: photoId }, contactIds, randomUUID);

const NO_EDITS = { added: [], removed: [] };
const idsOf = async (
  db: ReturnType<typeof makeTestDb>,
  assetIds: string[],
  edits: { added: string[]; removed: string[] } = NO_EDITS,
) => (await readMentions(db, assetIds, edits)).map((contact) => contact.id);

// Album "ridge" holds a1 (the post's photo) and a2; a3 is elsewhere. Elsewhere, Erebo is mentioned in
// posts and on a photo of another album. Lee has no handle.
async function library(db: ReturnType<typeof makeTestDb> = makeTestDb()) {
  await assets.createMany(
    db,
    ['a1', 'a2', 'a3', 'a4'].map((id) => makeAssetRecord({ id })),
  );
  await albums.createMany(db, [makeAlbumRecord({ id: 'ridge' }), makeAlbumRecord({ id: 'lake' })]);
  await albumEdges.add(db, 'ridge', ['a1', 'a2'], randomUUID);
  await albumEdges.add(db, 'lake', ['a3'], randomUUID);
  for (const contact of [
    makeContactRecord({ id: 'nico', name: 'Nico', xHandle: 'nico_hikes', blueskyHandle: 'nico.bsky.social' }),
    makeContactRecord({ id: 'ana', name: 'Ana', xHandle: 'https://x.com/ana_trails' }),
    makeContactRecord({ id: 'erebo', name: 'Erebo', xHandle: 'Erebo123' }),
    makeContactRecord({ id: 'lee', name: 'Lee' }),
  ])
    await contacts.create(db, contact);
  await tag(db, 'a3', ['erebo']);
  await createPost(db, { id: 'p1', text: 'Out with @Erebo123', postedAt: 10 }, ['a3']);
  await createPost(db, { id: 'p2', text: 'And @IzaickF', postedAt: 20 });
  return db;
}

describe('readMentions', () => {
  it("lists the contacts on the photos and their album's photos, with or without a handle, never the library's other people", async () => {
    const db = await library();
    await tag(db, 'a2', ['ana', 'lee']);
    await tag(db, 'a1', ['nico']);
    expect(await idsOf(db, ['a1'])).toEqual(['nico', 'ana', 'lee']);
  });

  it("adds the contacts the album's posts mention, by chip and by typed handle, in the most posts first, each once", async () => {
    const db = await library();
    await tag(db, 'a1', ['nico']);
    const erebo = { contactId: 'erebo', location: 5, name: 'Erebo' };
    await createPost(db, { id: 'p3', text: 'With Erebo', mentions: [erebo], postedAt: 30 }, ['a2']);
    await createPost(db, { id: 'p4', text: 'With @ana_trails and @NICO_hikes', postedAt: 40 }, ['a2']);
    await createPost(db, { id: 'p5', text: 'Again @ana_trails, and @ridgewalker', postedAt: 50 }, ['a2']);
    expect(await idsOf(db, ['a1'])).toEqual(['nico', 'ana', 'erebo']);
  });

  it('adds each contact a handle two contacts share means', async () => {
    const db = await library();
    await contacts.create(db, makeContactRecord({ id: 'nico2', name: 'Nico B', blueskyHandle: 'nico_hikes' }));
    await createPost(db, { id: 'p3', text: 'With @nico_hikes', postedAt: 30 }, ['a2']);
    expect(await idsOf(db, ['a1'])).toEqual(['nico', 'nico2']);
  });

  it("puts the sheet's added contacts first, leaves out the removed ones and an added one since deleted", async () => {
    const db = await library();
    await tag(db, 'a1', ['nico']);
    await tag(db, 'a2', ['ana']);
    await contacts.create(db, makeContactRecord({ id: 'gone', name: 'Gone' }));
    await contacts.deleteContact(db, 'gone');
    expect(await idsOf(db, ['a1'], { added: ['erebo', 'gone'], removed: ['ana'] })).toEqual(['erebo', 'nico']);
  });

  it('leaves out a contact taken off the photo, a deleted contact and a trashed photo', async () => {
    const db = await library();
    await tag(db, 'a1', ['nico']);
    await tag(db, 'a2', ['ana']);
    await contactLinks.remove(db, { targetType: 'asset', targetId: 'a1' }, ['nico']);
    await assets.remove(db, ['a2']);
    expect(await idsOf(db, ['a1'])).toEqual([]);
    await tag(db, 'a1', ['nico']);
    await contacts.deleteContact(db, 'nico');
    expect(await idsOf(db, ['a1'])).toEqual([]);
  });

  it('takes the contacts on photos in no album', async () => {
    const db = await library();
    await tag(db, 'a4', ['ana']);
    expect(await idsOf(db, ['a4'])).toEqual(['ana']);
  });

  it("reads every contact only when an album post holds a typed handle, else only the chips' contacts", async () => {
    const work = async (post: {
      text: string;
      mentions: { contactId: string; location: number; name: string }[] | null;
    }) => {
      const { db, measure } = makeMeasuredTestDb();
      await library(db);
      await createPost(db, { id: 'p3', ...post, postedAt: 30 }, ['a2']);
      return measure(() => readMentions(db, ['a1'], NO_EDITS));
    };
    const byChip = await work({ text: 'With Ana', mentions: [{ contactId: 'ana', location: 5, name: 'Ana' }] });
    const byHandle = await work({ text: 'With @ana_trails', mentions: null });
    // The library's three other contacts are read only for the typed handle.
    expect(byHandle.rowsRead - byChip.rowsRead).toBe(3);
  });
});
