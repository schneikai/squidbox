// Pure projections that reconstruct the record shapes the app UI expects from the junction-edge
// tables — so the ~78 consumers of `album.assets` / `post.assetRefs` / `postHistory` don't change.
// No DB access here (testable): providers pass in live rows from useLiveQuery.

export interface EdgeLite {
  id: string;
  assetId: string;
  position: string;
  deletedAt: number | null;
}
export interface AlbumEdge extends EdgeLite {
  albumId: string;
}
export interface PostEdge extends EdgeLite {
  postId: string;
}
export interface PostLite {
  id: string;
  postedAt: number | null;
  deletedAt: number | null;
}

// Live edges (deletedAt null), sorted by fractional position, deduped by assetId (a concurrent
// add on two offline devices can leave two edge rows for one asset; render it once).
function liveOrdered<E extends EdgeLite>(edges: E[]): E[] {
  const live = edges.filter((e) => e.deletedAt == null).sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
  const seen = new Set<string>();
  const out: E[] = [];
  for (const e of live) {
    if (seen.has(e.assetId)) continue;
    seen.add(e.assetId);
    out.push(e);
  }
  return out;
}

/** albumId → ordered assetId[] (for `album.assets`). */
export function orderedAssetsByAlbum(edges: AlbumEdge[]): Record<string, string[]> {
  const byAlbum: Record<string, AlbumEdge[]> = {};
  for (const e of edges) (byAlbum[e.albumId] ??= []).push(e);
  const out: Record<string, string[]> = {};
  for (const [albumId, list] of Object.entries(byAlbum)) out[albumId] = liveOrdered(list).map((e) => e.assetId);
  return out;
}

/** postId → ordered assetRefs `{id, assetId}[]` (for `post.assetRefs`; id is the edge id). */
export function assetRefsByPost(edges: PostEdge[]): Record<string, { id: string; assetId: string }[]> {
  const byPost: Record<string, PostEdge[]> = {};
  for (const e of edges) (byPost[e.postId] ??= []).push(e);
  const out: Record<string, { id: string; assetId: string }[]> = {};
  for (const [postId, list] of Object.entries(byPost)) {
    out[postId] = liveOrdered(list).map((e) => ({ id: e.id, assetId: e.assetId }));
  }
  return out;
}

// postHistory/lastPostedAt derivation — mirrors the old useRecalculatePostHistory: for each asset,
// the non-deleted posts that reference it, ordered by postedAt asc; lastPostedAt = the last one's.
export interface DerivedHistory {
  historyById: Record<string, string[]>;
  lastPostedAtById: Record<string, number | null>;
}

function historyFrom(postIdsById: Record<string, string[]>, postsById: Record<string, PostLite>): DerivedHistory {
  const historyById: Record<string, string[]> = {};
  const lastPostedAtById: Record<string, number | null> = {};
  for (const [id, postIds] of Object.entries(postIdsById)) {
    const ordered = postIds
      .map((pid) => postsById[pid])
      .filter((p): p is PostLite => !!p && p.deletedAt == null)
      .sort((a, b) => (a.postedAt ?? 0) - (b.postedAt ?? 0));
    historyById[id] = ordered.map((p) => p.id);
    lastPostedAtById[id] = ordered.length ? ordered[ordered.length - 1].postedAt ?? null : null;
  }
  return { historyById, lastPostedAtById };
}

/** assetId → its postHistory + lastPostedAt, from post_assets edges. */
export function deriveAssetPostHistory(postsById: Record<string, PostLite>, postEdges: PostEdge[]): DerivedHistory {
  const postIdsByAsset: Record<string, string[]> = {};
  for (const e of postEdges) {
    if (e.deletedAt != null) continue;
    (postIdsByAsset[e.assetId] ??= []).push(e.postId);
  }
  // dedupe post ids per asset (a post can reference an asset once, but edges could duplicate)
  for (const k of Object.keys(postIdsByAsset)) postIdsByAsset[k] = [...new Set(postIdsByAsset[k])];
  return historyFrom(postIdsByAsset, postsById);
}

/** albumId → its postHistory + lastPostedAt: posts referencing any asset the album contains. */
export function deriveAlbumPostHistory(
  postsById: Record<string, PostLite>,
  postEdges: PostEdge[],
  albumEdges: AlbumEdge[],
): DerivedHistory {
  const albumsByAsset: Record<string, string[]> = {};
  for (const e of albumEdges) {
    if (e.deletedAt != null) continue;
    (albumsByAsset[e.assetId] ??= []).push(e.albumId);
  }
  const postIdsByAlbum: Record<string, Set<string>> = {};
  for (const e of postEdges) {
    if (e.deletedAt != null) continue;
    for (const albumId of albumsByAsset[e.assetId] ?? []) {
      (postIdsByAlbum[albumId] ??= new Set()).add(e.postId);
    }
  }
  const flat: Record<string, string[]> = {};
  for (const [albumId, set] of Object.entries(postIdsByAlbum)) flat[albumId] = [...set];
  return historyFrom(flat, postsById);
}
