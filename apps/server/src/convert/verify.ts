import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  assets as assetsT,
  albums as albumsT,
  posts as postsT,
  albumAssets as albumAssetsT,
  postAssets as postAssetsT,
} from '../db/schema.js';

// Post-import referential + format check. Reads the imported rows back and verifies every id is a
// canonical uuid and every junction edge resolves to existing parent + asset records. Returns a
// list of violations (empty = clean) plus a few resolved samples for a human spot-check.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface VerifyReport {
  counts: { assets: number; albums: number; posts: number; albumAssets: number; postAssets: number };
  violations: string[];
  samples: string[];
}

export async function verifyImport(db: Db, userId: string): Promise<VerifyReport> {
  const assetRows = await db.select().from(assetsT).where(eq(assetsT.userId, userId));
  const albumRows = await db.select().from(albumsT).where(eq(albumsT.userId, userId));
  const postRows = await db.select().from(postsT).where(eq(postsT.userId, userId));
  const albumAssetRows = await db.select().from(albumAssetsT).where(eq(albumAssetsT.userId, userId));
  const postAssetRows = await db.select().from(postAssetsT).where(eq(postAssetsT.userId, userId));

  const assetIds = new Set(assetRows.map((r) => r.id));
  const albumIds = new Set(albumRows.map((r) => r.id));
  const postIds = new Set(postRows.map((r) => r.id));
  const violations: string[] = [];
  const bump = (msg: string) => {
    if (violations.length < 50) violations.push(msg);
  };
  const checkUuid = (kind: string, id: string) => {
    if (!UUID_RE.test(id)) bump(`${kind} id is not a canonical uuid: ${id}`);
  };

  for (const a of assetRows) checkUuid('asset', a.id);
  for (const al of albumRows) checkUuid('album', al.id);
  for (const p of postRows) checkUuid('post', p.id);

  for (const e of albumAssetRows) {
    checkUuid('album_asset', e.id);
    if (!albumIds.has(e.albumId)) bump(`album_asset ${e.id} -> missing album ${e.albumId}`);
    if (!assetIds.has(e.assetId)) bump(`album_asset ${e.id} -> missing asset ${e.assetId}`);
    if (!e.position) bump(`album_asset ${e.id} -> empty position`);
  }
  for (const e of postAssetRows) {
    checkUuid('post_asset', e.id);
    if (!postIds.has(e.postId)) bump(`post_asset ${e.id} -> missing post ${e.postId}`);
    if (!assetIds.has(e.assetId)) bump(`post_asset ${e.id} -> missing asset ${e.assetId}`);
    if (!e.position) bump(`post_asset ${e.id} -> empty position`);
  }

  // Spot-check: newest post + a non-empty album, relations resolved to filenames via edges.
  const samples: string[] = [];
  const assetById = new Map(assetRows.map((r) => [r.id, r]));
  const ordered = (edges: { assetId: string; position: string }[]) =>
    [...edges].sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));

  const newestPost = [...postRows].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
  if (newestPost) {
    const edges = ordered(postAssetRows.filter((e) => e.postId === newestPost.id));
    const files = edges.map((e) => assetById.get(e.assetId)?.filename ?? '??').join(', ');
    samples.push(`newest post ${newestPost.id}: "${newestPost.text.slice(0, 70)}" -> assets [${files}]`);
  }
  const albumEdgeCounts = new Map<string, number>();
  for (const e of albumAssetRows) albumEdgeCounts.set(e.albumId, (albumEdgeCounts.get(e.albumId) ?? 0) + 1);
  const bigAlbum = albumRows.find((a) => (albumEdgeCounts.get(a.id) ?? 0) > 0);
  if (bigAlbum) {
    const edges = ordered(albumAssetRows.filter((e) => e.albumId === bigAlbum.id)).slice(0, 3);
    const files = edges.map((e) => assetById.get(e.assetId)?.filename ?? '??').join(', ');
    samples.push(`album ${bigAlbum.id} "${bigAlbum.name}" (${albumEdgeCounts.get(bigAlbum.id)} assets): first -> [${files}]`);
  }

  return {
    counts: {
      assets: assetRows.length,
      albums: albumRows.length,
      posts: postRows.length,
      albumAssets: albumAssetRows.length,
      postAssets: postAssetRows.length,
    },
    violations,
    samples,
  };
}
