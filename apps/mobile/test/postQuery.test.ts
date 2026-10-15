import type { PostRecord } from '@squidbox/shared';
import { describe, it, expect, beforeEach } from 'vitest';

import { createPost as createPostRecord, makeAssetRecord } from './helpers/factory';
import { makeMeasuredTestDb } from './helpers/testDb';
import readPost from '../src/features/post-detail/readPost';
import postQuery from '../src/features/post-list/postQuery';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';

type Descriptor = Parameters<typeof postQuery>[0];

const posts = makeRepository('posts', schema.posts);
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
const postEdges = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
const postEdgeRows = makeRepository('post_assets', schema.postAssets);

let db: AppDb;
let measure: ReturnType<typeof makeMeasuredTestDb>['measure'];
let n: number;
const newId = () => `id-${++n}`;
beforeEach(() => {
  ({ db, measure } = makeMeasuredTestDb());
  n = 0;
});

// Posts are created in id order: p1 first.
function createPost(id: string, over: Partial<PostRecord> = {}, assetIds: string[] = []) {
  const time = Number(id.replace(/\D/g, '')) || 1;
  return createPostRecord(db, { id, createdAt: time, updatedAt: time, ...over }, assetIds, newId);
}
const ids = async (descriptor: Descriptor, limit = 100) =>
  (await postQuery(descriptor).read(db, { limit })).rows.map((row) => row.id);

describe('postQuery', () => {
  it('lists posts by postedAt with the id tie-break, NULL first ascending and last descending', async () => {
    await createPost('p1', { postedAt: 10 });
    await createPost('p2', { postedAt: 30 });
    await createPost('p3', { postedAt: 30 });
    await createPost('p4', { postedAt: null });
    await createPost('p5', { postedAt: 20, deletedAt: 5 });
    expect(await ids({ scope: 'all', sort: 'postedAt:desc' })).toEqual(['p3', 'p2', 'p1', 'p4']);
    expect(await ids({ scope: 'all', sort: 'postedAt:asc' })).toEqual(['p4', 'p1', 'p2', 'p3']);
    const { rows, count } = await postQuery({ scope: 'all' }).read(db, { limit: 2 });
    expect(rows.map((row) => row.id)).toEqual(['p3', 'p2']);
    expect(count).toBe(4);
  });

  it('carries each post its assets through its live edges, one per asset, deleted assets included', async () => {
    await repo.createAssets(db, [
      makeAssetRecord({ id: 'a1' }),
      makeAssetRecord({ id: 'a2', deletedAt: 9 }),
      makeAssetRecord({ id: 'a3' }),
    ]);
    await createPost('p1', {}, ['a3', 'a1', 'a2', 'gone']);
    await postEdgeRows.createMany(db, [
      { id: 'dup', createdAt: 1, updatedAt: 1, deletedAt: null, postId: 'p1', assetId: 'a1', position: 'zz' },
    ]);
    await postEdges.setRefs(db, 'p1', [
      { id: 'id-2', assetId: 'a1' },
      { id: 'id-1', assetId: 'a3' },
      { id: 'id-3', assetId: 'a2' },
      { id: 'id-4', assetId: 'gone' },
    ]);
    const [post] = (await postQuery({ scope: 'all' }).read(db, { limit: 10 })).rows;
    expect(post.postAssets.map((pa: { id: string; asset: { id: string } }) => [pa.id, pa.asset.id])).toEqual([
      ['id-2', 'a1'],
      ['id-1', 'a3'],
      ['id-3', 'a2'],
    ]);
    expect(post.postAssets[2].asset.deletedAt).toBe(9);
  });

  it('reads the count, the posts, their edges and their assets in one transaction', async () => {
    await repo.createAssets(db, [makeAssetRecord({ id: 'a1' })]);
    await createPost('p1', {}, ['a1']);
    const work = await measure(() => postQuery({ scope: 'all' }).read(db, { limit: 20 }));
    expect(work.commits).toBe(1);
    expect(work.statements).toBe(2 + 4);
  });

  it('reads one post without the count', async () => {
    await repo.createAssets(db, [makeAssetRecord({ id: 'a1' })]);
    await createPost('p1', {}, ['a1']);
    let post: { id: string } | null = null;
    const work = await measure(async () => (post = await readPost(db, 'p1')));
    expect(post!.id).toBe('p1');
    expect(work.statements).toBe(2 + 3);
    expect(await readPost(db, 'missing')).toBeNull();
  });

  it('scopes to an asset, an album, a post, the repost candidates and the ignored posts', async () => {
    await createPost('p1', {}, ['a1']);
    await createPost('p2', {}, ['a2']);
    await createPost('p3', { isIgnoredForRepost: true }, ['a1', 'a2']);
    await createPost('p4', { hasBeenReposted: true });
    await albumEdges.add(db, 'al', ['a2'], newId);
    await postEdges.remove(db, 'p2', ['a2']); // p2's edge is gone
    expect(await ids({ scope: { assetId: 'a1' } })).toEqual(['p3', 'p1']);
    expect(await ids({ scope: { albumId: 'al' } })).toEqual(['p3']);
    expect(await ids({ scope: { postId: 'p2' } })).toEqual(['p2']);
    expect(await ids({ scope: 'repostCandidates', sort: 'suggestRepostAt:asc' })).toEqual(['p1', 'p2']);
    expect(await ids({ scope: 'ignored', sort: 'updatedAt:desc' })).toEqual(['p3']);
  });

  it('turns an asset: or album: search into that scope', async () => {
    await createPost('p1', {}, ['a1']);
    await createPost('p2', { text: 'asset' }, ['a2']);
    await albumEdges.add(db, 'al', ['a2'], newId);
    expect(await ids({ scope: 'all', search: 'asset:a1' })).toEqual(['p1']);
    expect(await ids({ scope: 'all', search: ' Album:al ' })).toEqual(['p2']);
    expect(await ids({ scope: 'all', search: 'asset' })).toEqual(['p2']);
    expect(postQuery({ scope: 'all', search: 'asset:a1' }).tables).toContain(schema.postAssets);
    expect(postQuery({ scope: 'all', search: 'album:al' }).tables).toContain(schema.albumAssets);
  });

  it('sorts the repost candidates by their suggested date and the ignored posts by their update', async () => {
    await createPost('p1', { suggestRepostAt: 30, updatedAt: 1 });
    await createPost('p2', { suggestRepostAt: 10, updatedAt: 3 });
    await createPost('p3', { suggestRepostAt: 10, updatedAt: 2 });
    expect(await ids({ scope: 'repostCandidates', sort: 'suggestRepostAt:asc' })).toEqual(['p2', 'p3', 'p1']);
    // An unset suggestion (0) falls back to the post date, then to 0.
    await createPost('p4', { suggestRepostAt: 0, postedAt: 20 });
    await createPost('p5', { suggestRepostAt: 0, postedAt: null });
    expect(await ids({ scope: 'repostCandidates', sort: 'suggestRepostAt:asc' })).toEqual([
      'p5',
      'p2',
      'p3',
      'p4',
      'p1',
    ]);
    await posts.updateAll(db, ['p1', 'p2', 'p3'], { isIgnoredForRepost: true });
    const [first] = (await postQuery({ scope: 'ignored', sort: 'updatedAt:desc' }).read(db, { limit: 1 })).rows;
    expect(first.id).toBe('p3'); // ignored last
  });

  it('filters favorites and matches the search Unicode-aware, literally and once per read', async () => {
    await repo.createAssets(db, [makeAssetRecord({ id: 'a1' })]);
    await createPost('p1', { text: 'Über 50% done', isFavorite: true }, ['a1']);
    await createPost('p2', { text: 'under_score' });
    await createPost('p3', { text: 'plain', isFavorite: true });
    expect(await ids({ scope: 'all', filter: ['favorites'] })).toEqual(['p3', 'p1']);
    expect(await ids({ scope: 'all', search: 'über' })).toEqual(['p1']);
    expect(await ids({ scope: 'all', search: '%' })).toEqual(['p1']);
    expect(await ids({ scope: 'all', search: '_' })).toEqual(['p2']);
    expect(await ids({ scope: 'all', search: 'n', filter: ['favorites'] })).toEqual(['p3', 'p1']);
    const work = await measure(() => postQuery({ scope: 'all', search: 'n' }).read(db, { limit: 10 }));
    expect(work.statements).toBe(2 + 5);
    expect((await postQuery({ scope: 'all', search: 'n' }).read(db, { limit: 10 })).count).toBe(3);
  });
});
