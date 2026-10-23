import type { AssetRecord } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { createPost, makeAssetRecord } from './helpers/factory';
import { makeMeasuredTestDb } from './helpers/testDb';
import assetQuery from '../src/features/asset-list/assetQuery';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';

type Descriptor = Parameters<typeof assetQuery>[0];

const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
const AL = 'album-1';

let db: AppDb;
let measure: ReturnType<typeof makeMeasuredTestDb>['measure'];
let n: number;
const newId = () => `id-${++n}`;

beforeEach(() => {
  ({ db, measure } = makeMeasuredTestDb());
  n = 0;
});

function seedAssets(overrides: Partial<AssetRecord>[]): Promise<AssetRecord[]> {
  return repo.createMany(
    db,
    overrides.map((over, i) => makeAssetRecord({ id: `asset-${i}`, createdAt: 1000 + i, ...over })),
  );
}

const rowIds = (rows: { id: string }[]) => rows.map((row) => row.id);

describe('assetQuery', () => {
  it('lists the library newest first, with an id tie-break that holds across refreshes and pages', async () => {
    await seedAssets([{ createdAt: 5 }, { createdAt: 7 }, { createdAt: 7 }, { createdAt: 7 }, { createdAt: 6 }]);
    const desc = assetQuery({ scope: 'library', sort: 'createdAt:desc' });
    const first = await desc.read(db, { limit: 10 });
    expect(rowIds(first.rows)).toEqual(['asset-3', 'asset-2', 'asset-1', 'asset-4', 'asset-0']);
    expect(first.count).toBe(5);
    expect(rowIds((await desc.read(db, { limit: 10 })).rows)).toEqual(rowIds(first.rows));
    expect(rowIds((await desc.read(db, { limit: 2 })).rows)).toEqual(rowIds(first.rows).slice(0, 2));
    expect(await desc.ids(db)).toEqual(rowIds(first.rows));

    const asc = assetQuery({ scope: 'library', sort: 'createdAt:asc' });
    expect(await asc.ids(db)).toEqual(['asset-0', 'asset-4', 'asset-1', 'asset-2', 'asset-3']);
  });

  it('filters by favorites and media type like the grid did', async () => {
    await seedAssets([
      { isFavorite: true, mediaType: 'photo' },
      { isFavorite: false, mediaType: 'video' },
      { isFavorite: true, mediaType: 'video' },
    ]);
    const ids = (filter: Descriptor['filter']) => assetQuery({ scope: 'library', filter }).ids(db);
    expect(await ids(['favorites'])).toEqual(['asset-2', 'asset-0']);
    expect(await ids(['images'])).toEqual(['asset-0']);
    expect(await ids(['videos'])).toEqual(['asset-2', 'asset-1']);
    expect(await ids(['favorites', 'videos'])).toEqual(['asset-2']);
    expect(await ids(['images', 'videos'])).toEqual([]);
  });

  it('leaves out the excluded ids in every scope, the count included', async () => {
    await seedAssets([{}, { notes: 'beach' }, {}, { notes: 'beach' }]);
    await albumEdges.add(db, AL, ['asset-0', 'asset-1', 'asset-2'], newId);
    const exclude = ['asset-1', 'asset-2', 'gone'];
    expect(await assetQuery({ scope: 'library', exclude }).ids(db)).toEqual(['asset-3', 'asset-0']);
    expect(await assetQuery({ scope: { albumId: AL }, sort: 'custom', exclude }).ids(db)).toEqual(['asset-0']);
    expect(await assetQuery({ scope: 'library', search: 'beach', exclude }).ids(db)).toEqual(['asset-3']);
    expect((await assetQuery({ scope: 'library', exclude }).read(db, { limit: 10 })).count).toBe(2);
  });

  it("leaves out an album's live assets, the count included, and shows them again once removed", async () => {
    await seedAssets([{}, { notes: 'beach' }, {}, { notes: 'beach' }]);
    await albumEdges.add(db, AL, ['asset-0', 'asset-1', 'asset-2'], newId);
    await albumEdges.add(db, 'album-2', ['asset-1'], newId);
    const exclude = { albumId: AL };
    expect(await assetQuery({ scope: 'library', exclude }).ids(db)).toEqual(['asset-3']);
    expect(await assetQuery({ scope: { albumId: 'album-2' }, exclude }).ids(db)).toEqual([]);
    expect((await assetQuery({ scope: 'library', search: 'beach', exclude }).read(db, { limit: 10 })).count).toBe(1);

    await albumEdges.remove(db, AL, ['asset-1']);
    expect(await assetQuery({ scope: 'library', exclude }).ids(db)).toEqual(['asset-3', 'asset-1']);
    expect(await assetQuery({ scope: { albumId: 'album-2' }, exclude }).ids(db)).toEqual(['asset-1']);
  });

  it('matches the search Unicode-aware, literally and once per read', async () => {
    await seedAssets([{ notes: 'Über 50% done' }, { notes: 'under_score' }, { notes: 'plain' }, { notes: null }]);
    const search = (text: string) => assetQuery({ scope: 'library', search: text });
    expect(await search('über').ids(db)).toEqual(['asset-0']);
    expect(await search('%').ids(db)).toEqual(['asset-0']);
    expect(await search('_').ids(db)).toEqual(['asset-1']);
    expect(await search('  PLAIN ').ids(db)).toEqual(['asset-2']);
    expect(await search('   ').ids(db)).toHaveLength(4);

    const work = await measure(() => search('n').read(db, { limit: 10 }));
    expect(work.plans.filter((line) => line.includes('assets_notes_idx'))).toHaveLength(1);
    expect((await search('n').read(db, { limit: 10 })).count).toBe(3);
  });

  it('scopes to favorites, deleted (most recently deleted first) and an album', async () => {
    await seedAssets([{ isFavorite: true }, {}, { deletedAt: 20 }, { deletedAt: 30 }, { deletedAt: 30 }, {}]);
    await albumEdges.add(db, AL, ['asset-1', 'asset-5', 'asset-2'], newId);
    expect(await assetQuery({ scope: 'favorites' }).ids(db)).toEqual(['asset-0']);
    expect(await assetQuery({ scope: 'deleted', sort: 'createdAt:asc' }).ids(db)).toEqual([
      'asset-4',
      'asset-3',
      'asset-2',
    ]);
    expect(await assetQuery({ scope: { albumId: AL } }).ids(db)).toEqual(['asset-5', 'asset-1']);
    expect(await assetQuery({ scope: { albumId: AL }, sort: 'custom' }).ids(db)).toEqual(['asset-1', 'asset-5']);
    expect(await assetQuery({ scope: 'library' }).ids(db)).toEqual(['asset-5', 'asset-1', 'asset-0']);
  });

  it('scopes to one live asset alone, whatever the sort', async () => {
    await seedAssets([{}, {}, { deletedAt: 5 }]);
    await createPost(db, { id: 'p1', postedAt: 10 }, ['asset-1']);
    const one = assetQuery({ scope: { assetId: 'asset-1' } });
    const { rows, count } = await one.read(db, { limit: 10 });
    expect(rowIds(rows)).toEqual(['asset-1']);
    expect(count).toBe(1);
    expect(await assetQuery({ scope: { assetId: 'asset-1' }, sort: 'createdAt:asc' }).ids(db)).toEqual(['asset-1']);
    expect(await assetQuery({ scope: { assetId: 'asset-2' } }).ids(db)).toEqual([]); // deleted
    expect(rowIds(await one.rowsByIds(db, ['asset-0', 'asset-1', 'asset-2'])).sort()).toEqual(['asset-0', 'asset-1']);
  });

  it('shows an album in custom order once per asset, at its earliest edge, with a double edge', async () => {
    await seedAssets([{}, {}, {}]);
    await albumEdges.add(db, AL, ['asset-0', 'asset-1', 'asset-2'], newId);
    // A second live edge for asset-2 at the front (two offline devices adding it), ordered by (position, id).
    const edge = (id: string) => ({
      id,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      albumId: AL,
      assetId: 'asset-2',
      position: '5',
    });
    await makeRepository('album_assets', schema.albumAssets).createMany(db, [edge('dup-b'), edge('dup-a')]);
    const custom = assetQuery({ scope: { albumId: AL }, sort: 'custom' });
    const { rows, count } = await custom.read(db, { limit: 10 });
    expect(rowIds(rows)).toEqual(['asset-2', 'asset-0', 'asset-1']);
    expect(count).toBe(3);
    expect(await custom.ids(db)).toEqual(rowIds(rows));
    expect(rowIds((await custom.read(db, { limit: 1 })).rows)).toEqual(['asset-2']);

    const byDate = assetQuery({ scope: { albumId: AL } });
    expect((await byDate.read(db, { limit: 10 })).count).toBe(3);
    expect(await byDate.ids(db)).toEqual(['asset-2', 'asset-1', 'asset-0']);
  });

  it('shows a post in its order once per asset, a trashed asset too, whatever the sort', async () => {
    await seedAssets([{ createdAt: 1 }, { createdAt: 3, deletedAt: 5 }, { createdAt: 2 }, {}, {}]);
    await repo.update(db, 'asset-3', { deletedAt: 6, purgedAt: 7 });
    await createPost(db, { id: 'p1' }, ['asset-2', 'asset-0', 'asset-1', 'asset-3', 'asset-4'], newId);
    await createPost(db, { id: 'p2' }, ['asset-0'], newId);
    // A second live edge for asset-1 at the front (two offline devices adding it), and asset-4's
    // edge removed from the post.
    await makeRepository('post_assets', schema.postAssets).createMany(db, [
      { id: 'dup', createdAt: 1, updatedAt: 1, deletedAt: null, postId: 'p1', assetId: 'asset-1', position: '0' },
    ]);
    await db.update(schema.postAssets).set({ deletedAt: 9 }).where(eq(schema.postAssets.assetId, 'asset-4'));

    const post = assetQuery({ scope: { postId: 'p1' } });
    const { rows, count } = await post.read(db, { limit: 10 });
    expect(rowIds(rows)).toEqual(['asset-1', 'asset-2', 'asset-0']);
    expect(count).toBe(3);
    expect(await post.ids(db)).toEqual(rowIds(rows));
    expect(rowIds((await post.read(db, { limit: 2 })).rows)).toEqual(['asset-1', 'asset-2']);
    expect(await assetQuery({ scope: { postId: 'p1' }, sort: 'createdAt:asc' }).ids(db)).toEqual(rowIds(rows));
    expect(await assetQuery({ scope: { postId: 'p2' } }).ids(db)).toEqual(['asset-0']);
  });

  it('reads rows by id as the scope keeps them by deletion, matching it or not', async () => {
    await seedAssets([{ isFavorite: true }, { deletedAt: 5 }, { deletedAt: 5 }, {}]);
    await repo.update(db, 'asset-2', { purgedAt: 6 });
    const ids = ['asset-0', 'asset-1', 'asset-2', 'asset-3', 'gone'];
    const kept = async (scope: Descriptor['scope']) => rowIds(await assetQuery({ scope }).rowsByIds(db, ids)).sort();
    expect(await kept('favorites')).toEqual(['asset-0', 'asset-3']);
    expect(await kept('deleted')).toEqual(['asset-1']);
    expect(await kept({ postId: 'p1' })).toEqual(['asset-0', 'asset-1', 'asset-3']);
  });

  it('agrees between count and ids for every descriptor', async () => {
    await seedAssets([
      { isFavorite: true, notes: 'one' },
      { mediaType: 'video', notes: 'two' },
      { deletedAt: 1 },
      { isFavorite: true },
      {},
    ]);
    await albumEdges.add(db, AL, ['asset-0', 'asset-1', 'asset-2'], newId);
    await createPost(db, { id: 'p1', postedAt: 10 }, ['asset-1', 'asset-2', 'asset-0']);
    const descriptors: Descriptor[] = [
      { scope: 'library' },
      { scope: 'library', filter: ['favorites'] },
      { scope: 'library', filter: ['videos'], search: 'o' },
      { scope: 'library', sort: 'createdAt:asc', search: 'o' },
      { scope: 'favorites' },
      { scope: 'deleted' },
      { scope: { albumId: AL } },
      { scope: { albumId: AL }, sort: 'custom', filter: ['images'] },
      { scope: { albumId: AL }, sort: 'createdAt:asc' },
      { scope: { postId: 'p1' } },
      { scope: { postId: 'p1' }, filter: ['videos'], search: 'o' },
      { scope: { assetId: 'asset-1' }, search: 'o' },
      { scope: 'library', exclude: ['asset-0', 'asset-4'] },
      { scope: { albumId: AL }, exclude: ['asset-1'], search: 'o' },
      { scope: 'library', exclude: { albumId: AL }, sort: 'createdAt:asc' },
    ];
    for (const descriptor of descriptors) {
      const q = assetQuery(descriptor);
      const { rows, count } = await q.read(db, { limit: 100 });
      const ids = await q.ids(db);
      expect(count, JSON.stringify(descriptor)).toBe(ids.length);
      expect(rowIds(rows), JSON.stringify(descriptor)).toEqual(ids);
    }
  });

  it('reads a random sample of the limit with the full count', async () => {
    await seedAssets(Array.from({ length: 20 }, () => ({})));
    const random = assetQuery({ scope: 'library', sort: 'random' });
    const { rows, count } = await random.read(db, { limit: 5 });
    expect(rows).toHaveLength(5);
    expect(count).toBe(20);
    expect(new Set(rowIds(rows)).size).toBe(5);
  });

  it('refuses the custom sort outside an album', () => {
    expect(() => assetQuery({ scope: 'library', sort: 'custom' })).toThrow('album');
  });

  it('watches the tables its reads depend on', () => {
    expect(assetQuery({ scope: 'library' }).tables).toEqual([schema.assets]);
    expect(assetQuery({ scope: { albumId: AL } }).tables).toEqual([schema.assets, schema.albumAssets]);
    expect(assetQuery({ scope: { postId: 'p1' } }).tables).toEqual([schema.assets, schema.postAssets]);
    expect(assetQuery({ scope: 'library', exclude: { albumId: AL } }).tables).toEqual([
      schema.assets,
      schema.albumAssets,
    ]);
  });
});
