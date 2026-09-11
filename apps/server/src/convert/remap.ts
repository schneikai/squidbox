import { uuidv5 } from './uuidv5.js';

// Canonicalize every legacy record id to a real uuid and rewrite every cross-reference in
// lockstep, so the imported data has standard uuid ids and consistent relations — no leftover
// nanoid / undashed-hex ids anywhere. Mapping is deterministic (uuid v5 of the old id), so the
// import is idempotent and re-runnable.
//
// Reference fields rewritten:
//   asset.postHistory[]        -> post ids
//   album.assets[]             -> asset ids
//   album.postHistory[]        -> post ids
//   post.assetRefs[].id        -> the ref's own sub-id
//   post.assetRefs[].assetId   -> asset ids
//   post.rePostId              -> post id
//
// Deliberately NOT rewritten (not record-id relations): filename / thumbnailFilename (these are
// the real S3 object keys of the media — they embed the *old* id and must keep pointing at the
// stored files), mediaLibraryAssetId, oldFileId, oldCollectionName.

type AnyRecord = Record<string, any>;
export type LegacyMap = Record<string, AnyRecord>;

export interface LegacyData {
  assets?: LegacyMap;
  albums?: LegacyMap;
  posts?: LegacyMap;
}

export interface RemapStats {
  assetIds: number;
  albumIds: number;
  postIds: number;
  droppedAlbumAssetRefs: number;
  droppedAlbumPostHistory: number;
  droppedAssetPostHistory: number;
  droppedPostAssetRefs: number;
  droppedRePostIds: number;
}

/** Map a list of ref ids through `m`, dropping (counting) any that resolve to no record. */
function mapRefs(ids: unknown, m: Map<string, string>, drop: { n: number }): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    const to = m.get(id);
    if (to) out.push(to);
    else drop.n += 1;
  }
  return out;
}

export function remapLegacyIds(data: LegacyData): { data: LegacyData; stats: RemapStats } {
  const assetMap = new Map<string, string>();
  const albumMap = new Map<string, string>();
  const postMap = new Map<string, string>();

  // Pass 1: assign a canonical uuid to every existing record id.
  for (const oldId of Object.keys(data.assets ?? {})) assetMap.set(oldId, uuidv5(oldId));
  for (const oldId of Object.keys(data.albums ?? {})) albumMap.set(oldId, uuidv5(oldId));
  for (const oldId of Object.keys(data.posts ?? {})) postMap.set(oldId, uuidv5(oldId));

  const dAlbumAssets = { n: 0 };
  const dAlbumPosts = { n: 0 };
  const dAssetPosts = { n: 0 };
  const dPostRefs = { n: 0 };
  const dRePost = { n: 0 };

  // Pass 2: rewrite records + references.
  const assets: LegacyMap = {};
  for (const [oldId, e] of Object.entries(data.assets ?? {})) {
    const id = assetMap.get(oldId)!;
    assets[id] = { ...e, id, postHistory: mapRefs(e.postHistory, postMap, dAssetPosts) };
  }

  const albums: LegacyMap = {};
  for (const [oldId, e] of Object.entries(data.albums ?? {})) {
    const id = albumMap.get(oldId)!;
    albums[id] = {
      ...e,
      id,
      assets: mapRefs(e.assets, assetMap, dAlbumAssets),
      postHistory: mapRefs(e.postHistory, postMap, dAlbumPosts),
    };
  }

  const posts: LegacyMap = {};
  for (const [oldId, e] of Object.entries(data.posts ?? {})) {
    const id = postMap.get(oldId)!;
    const assetRefs = Array.isArray(e.assetRefs)
      ? e.assetRefs.flatMap((r: AnyRecord) => {
          const assetId = assetMap.get(r.assetId);
          if (!assetId) {
            dPostRefs.n += 1;
            return []; // drop refs whose asset no longer exists
          }
          // The ref's own sub-id is also canonicalized (namespaced by post+ref for uniqueness).
          return [{ id: uuidv5(`${oldId}:${r.id}`), assetId }];
        })
      : [];
    let rePostId: string | null = null;
    if (e.rePostId) {
      const to = postMap.get(e.rePostId);
      if (to) rePostId = to;
      else dRePost.n += 1;
    }
    posts[id] = { ...e, id, assetRefs, rePostId };
  }

  return {
    data: { assets, albums, posts },
    stats: {
      assetIds: assetMap.size,
      albumIds: albumMap.size,
      postIds: postMap.size,
      droppedAlbumAssetRefs: dAlbumAssets.n,
      droppedAlbumPostHistory: dAlbumPosts.n,
      droppedAssetPostHistory: dAssetPosts.n,
      droppedPostAssetRefs: dPostRefs.n,
      droppedRePostIds: dRePost.n,
    },
  };
}
