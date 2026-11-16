import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
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

// Album "ridge" holds a1 (the post's photo) and a2; a3 is elsewhere. Elsewhere, Jonas is mentioned in
// posts and on a photo of another album. Lee has no handle.
async function library() {
  const db = makeTestDb();
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
    makeContactRecord({ id: 'jonas', name: 'Jonas', xHandle: 'JonasPeaks' }),
    makeContactRecord({ id: 'lee', name: 'Lee' }),
  ])
    await contacts.create(db, contact);
  await tag(db, 'a3', ['jonas']);
  await createPost(db, { id: 'p1', text: 'Out with @JonasPeaks', postedAt: 10 }, ['a3']);
  await createPost(db, { id: 'p2', text: 'And @NoahF', postedAt: 20 });
  return db;
}

describe('readMentions', () => {
  it("lists the contacts on the photos and their album's photos, with or without a handle, never the library's other people", async () => {
    const db = await library();
    await tag(db, 'a2', ['ana', 'lee']);
    await tag(db, 'a1', ['nico']);
    expect(await idsOf(db, ['a1'])).toEqual(['nico', 'ana', 'lee']);
  });

  it("adds the contacts the album's posts mention by chip, in the most posts first, each once; a typed handle is none", async () => {
    const db = await library();
    await tag(db, 'a1', ['nico']);
    const jonas = { contactId: 'jonas', location: 5, name: 'Jonas' };
    const ana = (location: number) => ({ contactId: 'ana', location, name: 'Ana' });
    await createPost(db, { id: 'p3', text: 'With Jonas', mentions: [jonas], postedAt: 30 }, ['a2']);
    await createPost(db, { id: 'p4', text: 'With Ana and Nico', mentions: [ana(5)], postedAt: 40 }, ['a2']);
    await createPost(db, { id: 'p5', text: 'Again Ana, and @JonasPeaks', mentions: [ana(6)], postedAt: 50 }, ['a2']);
    expect(await idsOf(db, ['a1'])).toEqual(['nico', 'ana', 'jonas']);
  });

  it("puts the sheet's added contacts first, leaves out the removed ones and an added one since deleted", async () => {
    const db = await library();
    await tag(db, 'a1', ['nico']);
    await tag(db, 'a2', ['ana']);
    await contacts.create(db, makeContactRecord({ id: 'gone', name: 'Gone' }));
    await contacts.deleteContact(db, 'gone');
    expect(await idsOf(db, ['a1'], { added: ['jonas', 'gone'], removed: ['ana'] })).toEqual(['jonas', 'nico']);
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
});
