import { eq } from 'drizzle-orm';

import { a, assetOrder, assetScopeWhere, fromScope, placeInPost, postScopeEdges } from '@/sync/assetSql';
import type { AssetRow, PostRow } from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import type { PostAsset } from '@/utils/posts/buildPostAsset';

// An edge of a post scope with its asset.
type PostEdge = PostAsset<AssetRow> & { postId: string };

/**
 * The posts, each with its assets in order (`postAssets`), from one edge read in `tx`, read as the
 * asset screen reads a post's (assetQuery's post scope): a trashed asset still shows (it can come
 * back), a purged one never does (sync-design §7). With `firstAssetOnly`, only each post's first.
 */
export default async function withPostAssets<P extends PostRow>(
  tx: SyncDb,
  posts: P[],
  firstAssetOnly = false,
): Promise<(P & { postAssets: PostAsset<AssetRow>[] })[]> {
  const postIds = posts.map((post) => post.id);
  const postScope = { postId: postIds };
  const { e } = postScopeEdges(postScope);
  const edges = firstAssetOnly
    ? await readFirstEdges(tx, postScope)
    : await fromScope(tx.select({ id: e.id, postId: e.postId, asset: a }), postScope)
        .where(assetScopeWhere(postScope))
        .orderBy(e.postId, assetOrder(postScope));
  const byPost = new Map<string, PostAsset<AssetRow>[]>(postIds.map((id) => [id, []]));
  for (const { id, postId, asset } of edges) postAssetsOf(byPost, postId).push({ id, asset });
  return posts.map((post) => ({ ...post, postAssets: postAssetsOf(byPost, post.id) }));
}

// A post's assets in `byPost`; a post the read didn't ask for is a bug.
function postAssetsOf(byPost: Map<string, PostAsset<AssetRow>[]>, postId: string): PostAsset<AssetRow>[] {
  const postAssets = byPost.get(postId);
  if (!postAssets) throw new Error(`postQuery read no assets for post ${postId}`);
  return postAssets;
}

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
