import { beforeEach, describe, expect, it } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import readAlbumTagsSeed from '../src/features/album-tags/readAlbumTagsSeed';
import * as assets from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';

let db: SyncDb;
const albums = makeRepository('albums', schema.albums);
const albumAssets = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');

beforeEach(async () => {
  db = makeTestDb();
  await assets.createMany(db, [
    makeAssetRecord({ id: 'a1', createdAt: 1, tags: ['fog'] }),
    makeAssetRecord({ id: 'a2', createdAt: 3, tags: null }),
    makeAssetRecord({ id: 'a3', createdAt: 2, mediaType: 'video', tags: ['creek'] }),
    makeAssetRecord({ id: 'trashed', createdAt: 4, deletedAt: 5, tags: ['moss'] }),
  ]);
  await albums.createMany(db, [
    makeAlbumRecord({ id: 'dated' }),
    makeAlbumRecord({ id: 'custom', sortOrder: 'custom' }),
    makeAlbumRecord({ id: 'deleted', deletedAt: 5 }),
    makeAlbumRecord({ id: 'smart', smartAlbumType: 'FAVORITES' }),
  ]);
  for (const albumId of ['dated', 'custom'])
    await albumAssets.createFromRefs(
      db,
      albumId,
      ['a1', 'a2', 'a3', 'trashed'].map((assetId) => ({ id: `${albumId}-${assetId}`, assetId })),
    );
});

describe('readAlbumTagsSeed', () => {
  it("lists the album's live photos and videos with their tags, in its custom order", async () => {
    expect(await readAlbumTagsSeed(db, 'custom', {})).toEqual({
      photos: [
        { id: 'a1', tags: ['fog'] },
        { id: 'a2', tags: null },
        { id: 'a3', tags: ['creek'] },
      ],
    });
  });

  it('lists them in the sort picked for the album on this device, else newest first', async () => {
    const ids = async (sorts: Record<string, 'createdAt:asc'>) =>
      (await readAlbumTagsSeed(db, 'dated', sorts))?.photos.map((photo) => photo.id);
    expect(await ids({})).toEqual(['a2', 'a3', 'a1']);
    expect(await ids({ dated: 'createdAt:asc' })).toEqual(['a1', 'a3', 'a2']);
  });

  it('is null for a deleted, missing or smart album', async () => {
    expect(await readAlbumTagsSeed(db, 'deleted', {})).toBeNull();
    expect(await readAlbumTagsSeed(db, 'gone', {})).toBeNull();
    expect(await readAlbumTagsSeed(db, 'smart', {})).toBeNull();
  });
});
