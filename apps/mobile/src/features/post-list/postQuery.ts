import { and, asc, count, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  a,
  assetOrder,
  assetScopeWhere,
  contactTargetIds,
  fromScope,
  isIdScope,
  liveAlbumAssetIds,
  placeInPost,
  postAlbumAssetIds,
  postScopeEdges,
} from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import type { AssetRow, PostRow } from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { matchingIds } from '@/sync/matchingIds';
import { readThreadPosts } from '@/sync/postThreads';
import { isListedPost, listedPostId, postsHoldingAssets, repostDate } from '@/sync/postsRepository';
import type { PagedQuery } from '@/sync/usePagedQuery';
import type { PostAsset } from '@/utils/posts/buildPostAsset';

const p = alias(schema.posts, 'p');

/** Which posts a list shows (a contact's: the posts it is on). */
export type PostQueryScope =
  | 'all'
  | 'repostCandidates'
  | 'ignored'
  | { assetId: string }
  | { albumId: string }
  | { postId: string }
  | { sharesAlbumWithPostId: string }
  | { contactId: string };

export type PostSort = 'postedAt:asc' | 'postedAt:desc' | 'suggestRepostAt:asc' | 'updatedAt:desc';

/** `search` is a text substring, matched as the list did: Unicode-aware, literal, case-insensitive. */
export type PostQueryDescriptor = { scope?: PostQueryScope; sort?: PostSort; search?: string };

/** A post with its assets in order. */
export type PostWithAssets = PostRow & { postAssets: PostAsset<AssetRow>[] };

/** A row of a post list: the post with its assets and its live following posts' count. */
export type PostListRow = PostWithAssets & { threadCount: number };

/** A post as the `{ postId }` scope reads it: with its following posts in order, each with its assets. */
export type PostDetailRow = PostListRow & { threadPosts: PostWithAssets[] };

type ReadOptions = { limit?: number; firstAssetOnly?: boolean };

/** A paged query of post rows whose reads also take `firstAssetOnly`; `readRows` skips the count. */
export type PostQuery<Row> = PagedQuery<Row> & {
  descriptor: Required<PostQueryDescriptor>;
  read(db: SyncDb, options?: ReadOptions): Promise<{ rows: Row[]; count: number }>;
  readRows(db: SyncDb, options?: ReadOptions): Promise<Row[]>;
};

// An edge of a post scope with its asset.
type PostEdge = PostAsset<AssetRow> & { postId: string };

/**
 * What a post list shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one transaction
 * (no `limit` reads them all), `readRows(db, { limit })` → the rows alone (a read of one post),
 * each row a post with `postAssets: [{ id, asset }]` (its live edges in order, one per asset, a
 * deleted asset included; `firstAssetOnly` reads just the first, e.g. for a thumbnail) and
 * `threadCount` (its live following posts); `tables` → what a live read watches.
 * A thread is its first post: lists, counts and searches leave its following posts out (a search or
 * a photo found in one finds the thread), but a following post whose first post is deleted is a post
 * of its own. The `{ postId }` scope reads that exact post, with `threadPosts` (its following posts
 * in order, each with its `postAssets`).
 * Every order ends with an id tie-break, so refreshes and pages see one stable order.
 */
export default function postQuery(
  descriptor: PostQueryDescriptor & { scope: { postId: string } },
): PostQuery<PostDetailRow>;
export default function postQuery(descriptor: PostQueryDescriptor): PostQuery<PostListRow>;
export default function postQuery({
  scope = 'all',
  sort = 'postedAt:desc',
  search = '',
}: PostQueryDescriptor): PostQuery<PostListRow> {
  const descriptor = { scope, sort, search };
  const searchText = search.trim().toLowerCase();
  const direction = sort.endsWith(':asc') ? asc : desc;

  const tables: SQLiteTable[] = [schema.posts, schema.postAssets, schema.assets];
  if (isIdScope(scope, 'albumId')) tables.push(schema.albumAssets);
  if (isIdScope(scope, 'sharesAlbumWithPostId')) tables.push(schema.albumAssets, schema.albums);
  if (isIdScope(scope, 'contactId')) tables.push(schema.contactLinks);
  const isDetail = isIdScope(scope, 'postId');

  const scopeCondition = (() => {
    if (scope === 'repostCandidates') return and(eq(p.isIgnoredForRepost, false), eq(p.hasBeenReposted, false));
    if (scope === 'ignored') return eq(p.isIgnoredForRepost, true);
    if (typeof scope === 'string') return undefined;
    if ('postId' in scope) return eq(p.id, scope.postId);
    if ('contactId' in scope) return sql`${p.id} in ${contactTargetIds(scope.contactId, 'post')}`;
    if ('assetId' in scope) return sql`${p.id} in ${postsHoldingAssets(sql`asset_id = ${scope.assetId}`)}`;
    if ('albumId' in scope) {
      return sql`${p.id} in ${postsHoldingAssets(sql`asset_id in ${liveAlbumAssetIds(scope.albumId)}`)}`;
    }
    if ('sharesAlbumWithPostId' in scope) {
      const postId = scope.sharesAlbumWithPostId;
      return sql`${p.id} != ${postId} and ${p.id} in ${postsHoldingAssets(sql`asset_id in ${postAlbumAssetIds(postId)}`)}`;
    }
    return undefined;
  })();
  // The scopes above and the search pick listed posts already; the plain lists check each post.
  const threadCondition = typeof scope === 'string' ? isListedPost('p') : undefined;
  const order = (() => {
    if (sort === 'suggestRepostAt:asc') return [asc(repostDate(p)), asc(p.id)];
    if (sort === 'updatedAt:desc') return [desc(p.updatedAt), desc(p.id)];
    return [direction(p.postedAt), direction(p.id)];
  })();

  // The search runs over every live post's text, once per read for rows and count alike. A hit in a
  // following post finds the post it is listed as (listedPostId).
  async function matchedIds(tx: SyncDb): Promise<string[] | null> {
    if (!searchText) return null;
    const rows = await tx
      .select({ id: listedPostId('p'), text: p.text })
      .from(p)
      .where(isNull(p.deletedAt));
    return [...new Set(matchingIds(rows, searchText))];
  }
  const where = (ids: string[] | null) =>
    and(isNull(p.deletedAt), threadCondition, scopeCondition, ids ? inJson(p.id, ids) : undefined);

  async function readCount(tx: SyncDb, ids: string[] | null): Promise<number> {
    const [row] = await tx.select({ count: count() }).from(p).where(where(ids));
    return row?.count ?? 0;
  }

  // The rows of the posts matching `ids` (all without a search), in `tx`.
  async function rowsIn(
    tx: SyncDb,
    ids: string[] | null,
    { limit, firstAssetOnly = false }: ReadOptions,
  ): Promise<PostListRow[]> {
    const select = tx
      .select({ ...getTableColumns(p), threadCount })
      .from(p)
      .where(where(ids))
      .orderBy(...order);
    // No `limit` reads them all (drizzle's `limit` takes a number).
    const posts = await (limit === undefined ? select : select.limit(limit));
    if (!isDetail) {
      const byPost = await readPostAssets(
        tx,
        posts.map((post) => post.id),
        firstAssetOnly,
      );
      return withPostAssets(posts, byPost);
    }
    // The post screen and the editor's seed: the post's following posts too, one edge read for all.
    const following = await readThreadPosts(
      tx,
      posts.map((post) => post.id),
    );
    const byPost = await readPostAssets(
      tx,
      [...posts, ...following].map((post) => post.id),
      firstAssetOnly,
    );
    const threadPosts = withPostAssets(following, byPost);
    const rows: PostDetailRow[] = withPostAssets(posts, byPost).map((post) => ({
      ...post,
      threadPosts: threadPosts.filter((part) => part.threadRootId === post.id),
    }));
    return rows;
  }

  return {
    descriptor,
    tables,
    read(db, options = {}) {
      return db.transaction(async (tx) => {
        const ids = await matchedIds(tx);
        const total = await readCount(tx, ids);
        return { rows: await rowsIn(tx, ids, options), count: total };
      });
    },
    readRows(db, options = {}) {
      return db.transaction(async (tx) => rowsIn(tx, await matchedIds(tx), options));
    },
  };
}

// The posts' assets in order, by post, read as the asset screen reads a post's (assetQuery's post
// scope): a trashed asset still shows (it can come back), a purged one never does (sync-design §7).
// With `firstAssetOnly`, only each post's first.
async function readPostAssets(
  tx: SyncDb,
  postIds: string[],
  firstAssetOnly: boolean,
): Promise<Map<string, PostAsset<AssetRow>[]>> {
  const postScope = { postId: postIds };
  const { e } = postScopeEdges(postScope);
  const edges = firstAssetOnly
    ? await readFirstEdges(tx, postScope)
    : await fromScope(tx.select({ id: e.id, postId: e.postId, asset: a }), postScope)
        .where(assetScopeWhere(postScope))
        .orderBy(e.postId, assetOrder(postScope));
  const byPost = new Map<string, PostAsset<AssetRow>[]>(postIds.map((id) => [id, []]));
  for (const { id, postId, asset } of edges) postAssetsOf(byPost, postId).push({ id, asset });
  return byPost;
}

// The posts, each with its assets from `byPost`.
function withPostAssets<P extends PostRow>(
  posts: P[],
  byPost: Map<string, PostAsset<AssetRow>[]>,
): (P & { postAssets: PostAsset<AssetRow>[] })[] {
  return posts.map((post) => ({ ...post, postAssets: postAssetsOf(byPost, post.id) }));
}

// A post's assets in `byPost`; a post the read didn't ask for is a bug.
function postAssetsOf(byPost: Map<string, PostAsset<AssetRow>[]>, postId: string): PostAsset<AssetRow>[] {
  const postAssets = byPost.get(postId);
  if (!postAssets) throw new Error(`postQuery read no assets for post ${postId}`);
  return postAssets;
}

// A post's live following posts, counted over posts_thread_idx. `p.id` is spelled out: drizzle
// leaves a selected field's columns unqualified, which inside the subquery would name `c.id`.
const threadCount = sql`(select count(*) from posts c where c.thread_root_id = p.id and c.deleted_at is null)`
  .mapWith(Number)
  .as('thread_count');

// Each post's first edge of its scope (placeInPost), with its asset: one windowed pass over the
// scope's edges, then the asset rows of the first ones only.
function readFirstEdges(tx: SyncDb, postScope: { postId: string[] }): Promise<PostEdge[]> {
  const { e } = postScopeEdges(postScope);
  const ranked = fromScope(
    tx.select({ id: e.id, postId: e.postId, assetId: e.assetId, place: placeInPost(postScope).as('place') }),
    postScope,
  )
    .where(assetScopeWhere(postScope))
    .as('ranked');
  return tx
    .select({ id: ranked.id, postId: ranked.postId, asset: a })
    .from(ranked)
    .innerJoin(a, eq(a.id, ranked.assetId))
    .where(eq(ranked.place, 1));
}
