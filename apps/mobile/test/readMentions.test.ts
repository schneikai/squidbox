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

// Album "ridge" holds a1 (the post's photo) and a2; a3 is elsewhere. Elsewhere, Erebo is mentioned in
// posts and on a photo of another album.
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
    makeContactRecord({ id: 'erebo', name: 'Erebo', xHandle: 'Erebo123' }),
  ])
    await contacts.create(db, contact);
  await tag(db, 'a3', ['erebo']);
  await createPost(db, { id: 'p1', text: 'Out with @Erebo123', postedAt: 10 }, ['a3']);
  await createPost(db, { id: 'p2', text: 'And @IzaickF', postedAt: 20 });
  return db;
}

describe('readMentions', () => {
  it("takes the handles of the contacts on the photos and their album's photos, never the library's other people", async () => {
    const db = await library();
    await tag(db, 'a2', ['ana']);
    await tag(db, 'a1', ['nico']);
    expect(await readMentions(db, ['a1'])).toEqual({ handles: ['@nico_hikes', '@nico.bsky.social', '@ana_trails'] });
  });

  it("adds the handles of the album's posts after the contacts', each once without case", async () => {
    const db = await library();
    await tag(db, 'a1', ['nico']);
    await createPost(db, { id: 'p3', text: 'With @NICO_hikes and @ridgewalker', postedAt: 30 }, ['a2']);
    expect(await readMentions(db, ['a1'])).toEqual({
      handles: ['@nico_hikes', '@nico.bsky.social', '@ridgewalker'],
    });
  });

  it('leaves out a contact taken off the photo, a deleted contact and a trashed photo', async () => {
    const db = await library();
    await tag(db, 'a1', ['nico']);
    await tag(db, 'a2', ['ana']);
    await contactLinks.remove(db, { targetType: 'asset', targetId: 'a1' }, ['nico']);
    await assets.remove(db, ['a2']);
    expect(await readMentions(db, ['a1'])).toEqual({ handles: [] });
    await tag(db, 'a1', ['nico']);
    await contacts.deleteContact(db, 'nico');
    expect(await readMentions(db, ['a1'])).toEqual({ handles: [] });
  });

  it('takes the contacts on photos in no album', async () => {
    const db = await library();
    await tag(db, 'a4', ['ana']);
    expect(await readMentions(db, ['a4'])).toEqual({ handles: ['@ana_trails'] });
  });
});
