import { describe, it, expect, beforeEach } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import albumQuery from '../src/features/album-list/albumQuery';
import assetQuery from '../src/features/asset-list/assetQuery';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';
import getAlbumAssetScope from '../src/utils/albums/getAlbumAssetScope';
import getAlbumSortOrder from '../src/utils/albums/getAlbumSortOrder';

const albums = makeRepository('albums', schema.albums);
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
const albumEdgeRows = makeRepository('album_assets', schema.albumAssets);

const album = (id: string, over: Parameters<typeof makeAlbumRecord>[0] = {}) =>
  makeAlbumRecord({ id, name: id, ...over });

let db: AppDb;
let n: number;
const newId = () => `id-${++n}`;
beforeEach(() => {
  db = makeTestDb();
  n = 0;
});

// Six assets, asset-0 the oldest; asset-2 and asset-5 favorites; asset-4 deleted.
async function library() {
  await repo.createAssets(
    db,
    Array.from({ length: 6 }, (_, i) =>
      makeAssetRecord({
        id: `asset-${i}`,
        createdAt: 1000 + i,
        isFavorite: i === 2 || i === 5,
        deletedAt: i === 4 ? 9 : null,
      }),
    ),
  );
  await albums.createMany(db, [
    album('regular'),
    album('custom', { sortOrder: 'custom' }),
    album('favorites', { smartAlbumType: 'FAVORITES' }),
    album('deleted', { smartAlbumType: 'DELETED' }),
    album('gone', { deletedAt: 5 }),
  ]);
  await albumEdges.add(db, 'regular', ['asset-1', 'asset-2', 'asset-3', 'asset-4'], newId);
  await albumEdges.add(db, 'custom', ['asset-4', 'asset-3', 'asset-0'], newId);
}

const byId = async (q = albumQuery({ scope: 'all' })) =>
  Object.fromEntries((await q.read(db)).map((row) => [row.id, row]));

describe('albumQuery', () => {
  it('lists every non-deleted album with its live asset count, counting a double edge once', async () => {
    await library();
    await albumEdgeRows.createMany(db, [
      { id: 'dup', createdAt: 1, updatedAt: 1, deletedAt: null, albumId: 'regular', assetId: 'asset-2', position: 'z' },
    ]);
    const rows = await byId();
    expect(Object.keys(rows).sort()).toEqual(['custom', 'deleted', 'favorites', 'regular']);
    expect(rows.regular.assetCount).toBe(3); // asset-4 is deleted, asset-2 twice
    expect(rows.custom.assetCount).toBe(2);
    expect(rows.favorites.assetCount).toBe(2);
    expect(rows.deleted.assetCount).toBe(1);
    expect(rows.regular.coverAssetId).toBeUndefined();
  });

  it('covers follow the effective sort: the shared asset sort, or the custom order', async () => {
    await library();
    let rows = await byId(albumQuery({ scope: 'all', assetSort: 'createdAt:desc' }));
    expect(rows.regular.cover.id).toBe('asset-3');
    expect(rows.custom.cover.id).toBe('asset-3'); // the first edge's asset-4 is deleted
    expect(rows.favorites.cover.id).toBe('asset-5');
    rows = await byId(albumQuery({ scope: 'all', assetSort: 'createdAt:asc' }));
    expect(rows.regular.cover.id).toBe('asset-1');
    expect(rows.custom.cover.id).toBe('asset-3');
    expect(rows.favorites.cover.id).toBe('asset-2');
    expect(rows.deleted.cover.id).toBe('asset-4');
    expect(rows.regular.cover.filename).toBe('a.jpg'); // the whole asset row
  });

  it('covers under the lastPostedAt sort show the last posted asset first', async () => {
    await library();
    await createPost(db, { id: 'p1', postedAt: 10 }, ['asset-1']);
    await createPost(db, { id: 'p2', postedAt: 20 }, ['asset-2']);
    let rows = await byId(albumQuery({ scope: 'all', assetSort: 'lastPostedAt:desc' }));
    expect(rows.regular.cover.id).toBe('asset-2');
    expect(rows.favorites.cover.id).toBe('asset-2');
    rows = await byId(albumQuery({ scope: 'all', assetSort: 'lastPostedAt:asc' }));
    expect(rows.regular.cover.id).toBe('asset-3'); // the never-posted one first
    expect(rows.favorites.cover.id).toBe('asset-5');
  });

  it('a cover is the first cell its album shows, under every asset sort', async () => {
    await library();
    await albums.createMany(db, [album('empty')]);
    await albumEdgeRows.createMany(db, [
      { id: 'dup', createdAt: 1, updatedAt: 1, deletedAt: null, albumId: 'custom', assetId: 'asset-0', position: '0' },
    ]);
    await createPost(db, { postedAt: 10 }, ['asset-1']);
    await createPost(db, { postedAt: 20 }, ['asset-3', 'asset-5']);
    for (const assetSort of ['createdAt:asc', 'createdAt:desc', 'lastPostedAt:asc', 'lastPostedAt:desc'] as const) {
      for (const row of await albumQuery({ scope: 'all', assetSort }).read(db)) {
        const sort = getAlbumSortOrder(row, assetSort);
        const { rows } = await assetQuery({ scope: getAlbumAssetScope(row), sort }).read(db, { limit: 1 });
        expect(row.cover?.id, `${row.id} under ${sort}`).toBe(rows[0]?.id);
      }
    }
  });

  it('lastPostedAt is the newest live post of the album, and null for the smart albums', async () => {
    await library();
    await createPost(db, { id: 'p1', postedAt: 10 }, ['asset-1']);
    await createPost(db, { id: 'p2', postedAt: 30 }, ['asset-2']);
    await createPost(db, { id: 'p3', postedAt: 99, deletedAt: 5 }, ['asset-3']); // deleted post
    await createPost(db, { id: 'p4', postedAt: 50 }, ['asset-0']); // not in regular
    const rows = await byId();
    expect(rows.regular.lastPostedAt).toBe(30);
    expect(rows.custom.lastPostedAt).toBe(50);
    expect(rows.favorites.lastPostedAt).toBeNull();
    expect(rows.deleted.lastPostedAt).toBeNull();
  });

  it('an album without assets has no cover and no count', async () => {
    await albums.createMany(db, [album('empty')]);
    const [row] = await albumQuery({ scope: 'all' }).read(db);
    expect(row.cover).toBeUndefined();
    expect(row.assetCount).toBe(0);
    expect(row.lastPostedAt).toBeNull();
  });

  it('scopes to the albums holding any of some assets, through live edges', async () => {
    await library();
    await albumEdges.remove(db, 'custom', ['asset-0']);
    const ids = async (assetIds: string[]) =>
      (await albumQuery({ scope: { assetIds } }).read(db)).map((row) => row.id).sort();
    expect(await ids(['asset-3'])).toEqual(['custom', 'regular']);
    expect(await ids(['asset-1', 'asset-0'])).toEqual(['regular']);
    expect(await ids(['asset-5'])).toEqual([]);
  });

  it('skips lastPostedAt, and watching the posts, without withLastPostedAt', async () => {
    await library();
    const query = albumQuery({ scope: { assetIds: ['asset-3'] }, withLastPostedAt: false });
    const rows = await query.read(db);
    expect(rows.length).toBe(2);
    expect(rows.every((row) => !('lastPostedAt' in row) && row.cover)).toBe(true);
    expect(query.tables).not.toContain(schema.posts);
  });
});
