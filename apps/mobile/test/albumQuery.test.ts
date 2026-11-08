import { describe, it, expect, beforeEach } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import albumQuery, { type AlbumListRow } from '../src/features/album-list/albumQuery';
import albumSearchQuery from '../src/features/album-list/albumSearchQuery';
import matchedAlbumIds from '../src/features/album-list/matchedAlbumIds';
import prepareAlbums from '../src/features/album-list/prepareAlbums';
import assetQuery from '../src/features/asset-list/assetQuery';
import * as repo from '../src/sync/assetsRepository';
import * as contacts from '../src/sync/contactsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { contactLinks } from '../src/sync/membershipRepository';
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
  await repo.createMany(
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
    expect(rows.regular).not.toHaveProperty('coverAssetId');
  });

  it("covers follow the effective sort: the album's own sort, or the custom order", async () => {
    await library();
    let rows = await byId(albumQuery({ scope: 'all' }));
    expect(rows.regular.cover).toMatchObject({ id: 'asset-3' });
    expect(rows.custom.cover).toMatchObject({ id: 'asset-3' }); // the first edge's asset-4 is deleted
    expect(rows.favorites.cover).toMatchObject({ id: 'asset-5' });
    rows = await byId(albumQuery({ scope: 'all', oldestFirstIds: ['regular', 'custom', 'favorites'] }));
    expect(rows.regular.cover).toMatchObject({ id: 'asset-1', filename: 'a.jpg' }); // the whole asset row
    expect(rows.custom.cover).toMatchObject({ id: 'asset-3' });
    expect(rows.favorites.cover).toMatchObject({ id: 'asset-2' });
    expect(rows.deleted.cover).toMatchObject({ id: 'asset-4' });
  });

  it('a cover is the first cell its album shows, under every asset sort', async () => {
    await library();
    await albums.createMany(db, [album('empty')]);
    await albumEdgeRows.createMany(db, [
      { id: 'dup', createdAt: 1, updatedAt: 1, deletedAt: null, albumId: 'custom', assetId: 'asset-0', position: '0' },
    ]);
    await createPost(db, { postedAt: 10 }, ['asset-1']);
    await createPost(db, { postedAt: 20 }, ['asset-3', 'asset-5']);
    for (const order of ['createdAt:asc', 'createdAt:desc'] as const) {
      const albumSortOrders =
        order === 'createdAt:asc' ? { regular: order, custom: order, favorites: order, empty: order } : {};
      const oldestFirstIds = Object.keys(albumSortOrders);
      for (const row of await albumQuery({ scope: 'all', oldestFirstIds }).read(db)) {
        const sort = getAlbumSortOrder(row, albumSortOrders);
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

  it('says how many of the scope assets each album holds', async () => {
    await library();
    const rows = await albumQuery({ scope: { assetIds: ['asset-3', 'asset-1', 'asset-9'] } }).read(db);
    expect(Object.fromEntries(rows.map((row) => [row.id, row.heldCount]))).toEqual({ regular: 2, custom: 1 });
  });

  it('gives scoped rows their lastPostedAt', async () => {
    await library();
    const rows = await albumQuery({ scope: { assetIds: ['asset-3'] } }).read(db);
    expect(rows.length).toBe(2);
    expect(rows.every((row) => 'lastPostedAt' in row)).toBe(true);
  });
});

describe('album search', () => {
  // library(), plus albums to search: Portraits holds the live asset-1 and Old only the deleted asset-4,
  // both photos of Anna (so does library()'s `regular`, holding asset-1 too).
  async function searchLibrary() {
    await library();
    await albums.createMany(db, [
      album('Sao Paulo'),
      album('Trip', { notes: 'Beach week' }),
      album('Portraits'),
      album('Old'),
      album('Anna', { deletedAt: 5 }),
    ]);
    await albumEdges.add(db, 'Portraits', ['asset-1'], newId);
    await albumEdges.add(db, 'Old', ['asset-4'], newId);
    await contacts.create(db, makeContactRecord({ id: 'anna', name: 'Anna Müller' }));
    await contactLinks.add(db, { targetType: 'asset', targetId: 'asset-1' }, ['anna'], newId);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'asset-4' }, ['anna'], newId);
    return albumQuery({ scope: 'all' }).read(db);
  }

  async function found(rows: AlbumListRow[], search: string) {
    const ids = matchedAlbumIds(rows, await albumSearchQuery(search).read(db));
    return ids && [...ids].sort();
  }

  it('albumSearchQuery finds the live albums holding a live photo of a contact the search matches, as matchingIds does', async () => {
    await searchLibrary();
    const { contactAlbumIds } = await albumSearchQuery('mueller').read(db);
    expect(contactAlbumIds.sort()).toEqual(['Portraits', 'regular']);
  });

  it('albumSearchQuery reads and watches nothing without a search', async () => {
    const query = albumSearchQuery('  ');
    expect(await query.read(db)).toEqual({ search: '', contactAlbumIds: [] });
    expect(query.tables).toEqual([]);
  });

  it("matchedAlbumIds finds the albums by name and notes, as matchingIds does, and by their contacts' photos", async () => {
    const rows = await searchLibrary();
    expect(await found(rows, 'são')).toEqual(['Sao Paulo']);
    expect(await found(rows, 'BEACH')).toEqual(['Trip']);
    expect(await found(rows, 'anna')).toEqual(['Portraits', 'regular']); // not the deleted album named Anna
  });

  it('matchedAlbumIds is null without a search, keeping every album', async () => {
    expect(await found(await searchLibrary(), '')).toBeNull();
  });

  it('prepareAlbums keeps the matched albums only, and all without a search', async () => {
    await albums.createMany(db, [album('Trip'), album('Hike')]);
    const rows = await albumQuery({ scope: 'all' }).read(db);
    const names = (matchedIds: ReadonlySet<string> | null) =>
      prepareAlbums({ albums: rows, sortOrder: 'createdAt:asc', matchedIds })
        .map((row) => row.id)
        .sort();
    expect(names(new Set(['Trip']))).toEqual(['Trip']);
    expect(names(null)).toEqual(['Hike', 'Trip']);
  });
});
