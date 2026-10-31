import { describe, it, expect } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { mergeLosses } from './helpers/mergeLosses';
import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';

const ALBUM = 'album-1';
const photo = makeAssetRecord({
  mediaLibraryAssetId: 'm-ridge',
  filename: 'ridge.jpg',
  isFavorite: true,
  notes: 'sunrise on the ridge',
});

const db = makeTestDb();

interface Merged {
  records?: Partial<schema.AssetRow>[];
  member?: string | null;
  files?: string[];
  meta?: string[];
}

// The device library holds `photo`, a favorite with a note in ALBUM. `merged` is what the account's
// library holds after the merge; by default it kept all of it.
async function lossesAfter({
  records = [{}],
  member = photo.id,
  files = [photo.filename],
  meta = [],
}: Merged = {}): Promise<string[]> {
  for (const table of [schema.assets, schema.albumAssets, schema.syncMeta]) await db.delete(table);
  // The device's photo as a merge reads it, every column filled in.
  await db.insert(schema.assets).values({ ...photo, syncError: null });
  const liveDevice = await db.select().from(schema.assets);
  await db.delete(schema.assets);
  for (const over of records) await db.insert(schema.assets).values({ ...photo, syncError: null, ...over });
  if (member)
    await db
      .insert(schema.albumAssets)
      .values({ id: 'edge-1', createdAt: 1000, updatedAt: 1000, albumId: ALBUM, assetId: member, position: 'a0' });
  for (const key of meta) await db.insert(schema.syncMeta).values({ key, value: 'x' });
  return mergeLosses(db, liveDevice, [photo.id], (filename) => files.includes(filename), 'at');
}

describe('mergeLosses', () => {
  it('reports nothing when the merge kept every photo, file, favorite, note and album membership', async () => {
    expect(await lossesAfter()).toEqual([]);
  });

  it.each([
    // A missing photo takes its favorite, note and album membership with it.
    [
      'missing photo',
      { records: [], member: null },
      'at: ridge.jpg is missing',
      ["at: ridge.jpg's favorite", "at: ridge.jpg's note", 'at: the album lost ridge.jpg'],
    ],
    ['photo kept by id without its file', { files: [] }, 'at: ridge.jpg has no file'],
    [
      'camera-roll item none of whose records has a file',
      { records: [{ id: 'other', filename: 'other.jpg', isFileSynced: false }], member: 'other', files: [] },
      "at: no record of ridge.jpg's item has a file",
    ],
    ['lost favorite', { records: [{ isFavorite: false }] }, "at: ridge.jpg's favorite"],
    ['lost note', { records: [{ notes: null }] }, "at: ridge.jpg's note"],
    ['lost album membership', { member: null }, 'at: the album lost ridge.jpg'],
    ['merge key left in sync_meta', { meta: ['mergedInto'] }, 'at: mergedInto left'],
  ] satisfies [string, Merged, string, string[]?][])('reports a %s', async (_kind, merged, loss, along = []) => {
    expect(await lossesAfter(merged)).toEqual([loss, ...along]);
  });

  it('still reports the lost favorite and note of a photo whose record is deleted but not purged', async () => {
    expect(await lossesAfter({ records: [{ deletedAt: 2000, isFavorite: false, notes: null }] })).toEqual([
      "at: ridge.jpg's favorite",
      "at: ridge.jpg's note",
    ]);
  });
});
