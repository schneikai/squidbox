import { and, eq, isNull } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createThread, makeAlbumRecord, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as assets from '../src/sync/assetsRepository';
import * as contacts from '../src/sync/contactsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { contactLinks } from '../src/sync/membershipRepository';
import { moveGroupLinksToPhotos } from '../src/sync/photoContacts';
import { makeRepository } from '../src/sync/repository';

let db: SyncDb;
let n: number;
const newId = () => `edge-${++n}`;

beforeEach(async () => {
  db = makeTestDb();
  n = 0;
  await contacts.create(db, makeContactRecord({ id: 'maya', name: 'Maya' }));
  await assets.createMany(
    db,
    ['a1', 'a2', 'a3', 'a4'].map((id) => makeAssetRecord({ id })),
  );
});

// The live links, as `type:target:contact`.
async function liveLinks(): Promise<string[]> {
  const l = schema.contactLinks;
  const rows = await db.select().from(l).where(isNull(l.deletedAt));
  return rows.map((row) => `${row.targetType}:${row.targetId}:${row.contactId}`).sort();
}

describe('moveGroupLinksToPhotos', () => {
  it('moves a contact on an album onto its untrashed photos, and takes it off the album', async () => {
    await assets.remove(db, ['a2']);
    const albums = makeRepository('albums', schema.albums);
    await albums.createMany(db, [makeAlbumRecord({ id: 'al1' })]);
    const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
    await albumEdges.createFromRefs(db, 'al1', [
      { id: 'ae1', assetId: 'a1' },
      { id: 'ae2', assetId: 'a2' },
    ]);
    await contactLinks.add(db, { targetType: 'album', targetId: 'al1' }, ['maya'], newId);
    expect(await moveGroupLinksToPhotos(db, newId)).toBe(true);
    expect(await liveLinks()).toEqual(['asset:a1:maya']);
  });

  it("moves a contact on a post onto its thread's photos", async () => {
    await createThread(db, { id: 'p1', assetIds: ['a1'] }, [{ id: 'p2', assetIds: ['a3'] }]);
    await contactLinks.add(db, { targetType: 'post', targetId: 'p1' }, ['maya'], newId);
    await moveGroupLinksToPhotos(db, newId);
    expect(await liveLinks()).toEqual(['asset:a1:maya', 'asset:a3:maya']);
  });

  it('writes nothing once no album or post has a contact', async () => {
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a4' }, ['maya'], newId);
    expect(await moveGroupLinksToPhotos(db, newId)).toBe(false);
    const l = schema.contactLinks;
    expect(
      await db
        .select()
        .from(l)
        .where(and(eq(l.targetId, 'a4'))),
    ).toHaveLength(1);
  });
});
