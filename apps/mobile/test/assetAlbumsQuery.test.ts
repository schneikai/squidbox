import { describe, it, expect, beforeEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import assetAlbumsQuery from '../src/features/asset-detail/details/assetAlbumsQuery';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';

const albums = makeRepository('albums', schema.albums);
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');

let db: AppDb;
let n: number;
const newId = () => `id-${++n}`;
beforeEach(() => {
  db = makeTestDb();
  n = 0;
});

describe('assetAlbumsQuery', () => {
  it('lists the live albums holding the asset through a live edge, with their live asset counts', async () => {
    await repo.createAssets(db, [
      makeAssetRecord({ id: 'a1' }),
      makeAssetRecord({ id: 'a2' }),
      makeAssetRecord({ id: 'a3', deletedAt: 9 }),
    ]);
    await albums.createMany(db, [
      makeAlbumRecord({ id: 'trip', name: 'Trip' }),
      makeAlbumRecord({ id: 'left', name: 'Left' }),
      makeAlbumRecord({ id: 'other', name: 'Other' }),
      makeAlbumRecord({ id: 'gone', name: 'Gone', deletedAt: 5 }),
    ]);
    await albumEdges.add(db, 'trip', ['a1', 'a2', 'a3'], newId);
    await albumEdges.add(db, 'left', ['a1'], newId);
    await albumEdges.remove(db, 'left', ['a1']);
    await albumEdges.add(db, 'other', ['a2'], newId);
    await albumEdges.add(db, 'gone', ['a1'], newId);

    const rows = await assetAlbumsQuery('a1').read(db);
    expect(rows.map(({ id, name, assetCount }) => ({ id, name, assetCount }))).toEqual([
      { id: 'trip', name: 'Trip', assetCount: 2 },
    ]);
  });
});
