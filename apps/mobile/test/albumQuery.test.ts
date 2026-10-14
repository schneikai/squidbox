import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import albumQuery from '../src/features/album-list/albumQuery';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';

const albums = makeRepository('albums', schema.albums);
const posts = makeRepository('posts', schema.posts);
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
const postEdges = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
const albumEdgeRows = makeRepository('album_assets', schema.albumAssets);

const album = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: id,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  isFavorite: false,
  archivedAt: null,
  showInPostSuggestionsAfter: null,
  oldCollectionName: null,
  notes: null,
  sortOrder: null,
  smartAlbumType: null,
  position: null,
  ...over,
});

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

async function createPost(id: string, postedAt: number | null, assetIds: string[], deletedAt: number | null = null) {
  await posts.create(db, {
    id,
    createdAt: 1,
    updatedAt: 1,
    deletedAt,
    text: '',
    isFavorite: false,
    postedAt,
    rePostId: null,
    isIgnoredForRepost: false,
    suggestRepostAt: 0,
    hasBeenReposted: false,
  });
  await postEdges.createFromRefs(
    db,
    id,
    assetIds.map((assetId) => ({ id: newId(), assetId })),
  );
}

const byId = async (q = albumQuery({ scope: 'all' })) =>
  Object.fromEntries((await q.page(db)).map((row) => [row.id, row]));

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
    await createPost('p1', 10, ['asset-1']);
    await createPost('p2', 20, ['asset-2']);
    let rows = await byId(albumQuery({ scope: 'all', assetSort: 'lastPostedAt:desc' }));
    expect(rows.regular.cover.id).toBe('asset-2');
    expect(rows.favorites.cover.id).toBe('asset-2');
    rows = await byId(albumQuery({ scope: 'all', assetSort: 'lastPostedAt:asc' }));
    expect(rows.regular.cover.id).toBe('asset-3'); // the never-posted one first
    expect(rows.favorites.cover.id).toBe('asset-5');
  });

  it('lastPostedAt is the newest live post of the album, and null for the smart albums', async () => {
    await library();
    await createPost('p1', 10, ['asset-1']);
    await createPost('p2', 30, ['asset-2']);
    await createPost('p3', 99, ['asset-3'], 5); // deleted post
    await createPost('p4', 50, ['asset-0']); // not in regular
    const rows = await byId();
    expect(rows.regular.lastPostedAt).toBe(30);
    expect(rows.custom.lastPostedAt).toBe(50);
    expect(rows.favorites.lastPostedAt).toBeNull();
    expect(rows.deleted.lastPostedAt).toBeNull();
  });

  it('an album without assets has no cover and no count', async () => {
    await albums.createMany(db, [album('empty')]);
    const [row] = await albumQuery({ scope: 'all' }).page(db);
    expect(row.cover).toBeNull();
    expect(row.assetCount).toBe(0);
    expect(row.lastPostedAt).toBeNull();
  });

  it('scopes to the albums holding any of some assets, through live edges', async () => {
    await library();
    await albumEdges.remove(db, 'custom', ['asset-0']);
    const ids = async (assetIds: string[]) =>
      (await albumQuery({ scope: { assetIds } }).page(db)).map((row) => row.id).sort();
    expect(await ids(['asset-3'])).toEqual(['custom', 'regular']);
    expect(await ids(['asset-1', 'asset-0'])).toEqual(['regular']);
    expect(await ids(['asset-5'])).toEqual([]);
  });
});
