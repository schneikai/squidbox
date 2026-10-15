import { and, inArray, isNull } from 'drizzle-orm';

import { fileExists, moveFile } from './fs';
import type { LibraryPaths } from './libraryPaths';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { enqueueMutations, outboxUpdatedAts } from '@/sync/outbox';
import { readByIdMap, readByIds } from '@/sync/readByIds';
import { saveRecords } from '@/sync/saveRecords';
import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';

type AssetRow = schema.AssetRow;
type OutboxRow = typeof schema.outbox.$inferSelect;
type Edge = { id: string; updatedAt: number; deletedAt: number | null; assetId: string } & Record<string, unknown>;

export interface MergeCounts {
  photos: number;
  albums: number;
  posts: number;
  alreadyInAccount: number; // photos the account has (same id, or the same camera-roll item)
  cloudOnly: number; // photos whose file is in another account's storage: they stay in the source
}

export interface MergePlan {
  counts: MergeCounts;
  assets: AssetRow[];
  albums: schema.AlbumRow[];
  posts: schema.PostRow[];
  albumAssets: schema.AlbumAssetRow[];
  postAssets: schema.PostAssetRow[];
  // Target assets that match a source asset by camera-roll item: favorite merged as OR, notes kept.
  duplicates: { id: string; isFavorite: boolean; notes: string | null }[];
  // Source outbox rows for records the target already has, to push with their own updatedAt.
  replays: OutboxRow[];
  // Source assets the target has by id: their files may still be in the source (moveMergedFiles).
  sameIdAssets: AssetRow[];
  // Every source record is in the target or skipped by a rule that leaves nothing behind.
  nothingLeftToAdd: boolean;
}

const live = <R extends { deletedAt: number | null }>(rows: R[]) => rows.filter((row) => row.deletedAt === null);

/**
 * What adding `source` (this device's library) to `target` (the account's) would do, without
 * writing anything (library-ownership plan §1.5 (f)). Tombstones are left behind; a record the
 * target has by id is skipped (a pending edit of it is replayed when newer); an asset the target
 * has from the same camera-roll item is matched instead of copied; an asset whose file lives in
 * another account's storage stays; smart albums are the account's own; edges follow their asset
 * and parent and are dropped with them.
 */
export async function planMerge(source: SyncDb, target: SyncDb, sourcePaths: LibraryPaths): Promise<MergePlan> {
  const counts: MergeCounts = { photos: 0, albums: 0, posts: 0, alreadyInAccount: 0, cloudOnly: 0 };
  const replays: OutboxRow[] = [];
  const sourceOutbox = new Map(
    (await source.select().from(schema.outbox)).map((row) => [`${row.collection}:${row.recordId}`, row]),
  );

  // A source outbox row for a record the target has is worth pushing only when it is newer than
  // what the target holds, in its row and in its own outbox.
  async function collectReplays(
    collection: string,
    rows: { id: string; updatedAt: number }[],
    targetRows: Map<string, { updatedAt: number }>,
  ) {
    const pending = await outboxUpdatedAts(
      target,
      collection,
      rows.map((row) => row.id),
    );
    for (const row of rows) {
      const outboxRow = sourceOutbox.get(`${collection}:${row.id}`);
      const targetRow = targetRows.get(row.id);
      if (!outboxRow || !targetRow) continue;
      if (outboxRow.updatedAt <= targetRow.updatedAt) continue;
      if ((pending.get(row.id) ?? -1) >= outboxRow.updatedAt) continue;
      replays.push(outboxRow);
    }
  }

  // Assets.
  const sourceAssets = live(await source.select().from(schema.assets));
  const targetById = await readByIdMap<AssetRow>(
    target,
    schema.assets,
    sourceAssets.map((asset) => asset.id),
  );
  const mediaIds = sourceAssets.map((asset) => asset.mediaLibraryAssetId).filter(Boolean);
  const targetByMediaId = new Map<string, AssetRow>();
  if (mediaIds.length > 0) {
    const rows = await target
      .select()
      .from(schema.assets)
      .where(and(inArray(schema.assets.mediaLibraryAssetId, mediaIds), isNull(schema.assets.deletedAt)));
    for (const row of rows) targetByMediaId.set(row.mediaLibraryAssetId, row);
  }
  const assets: AssetRow[] = [];
  const sameIdAssets: AssetRow[] = [];
  const duplicates: MergePlan['duplicates'] = [];
  const assetIdMap = new Map<string, string>(); // source asset id → the id it has in the target
  const inTarget = (id: string) => targetById.has(id);
  for (const asset of sourceAssets) {
    if (inTarget(asset.id)) {
      assetIdMap.set(asset.id, asset.id);
      sameIdAssets.push(asset);
      counts.alreadyInAccount += 1;
      continue;
    }
    if (asset.isFileSynced && !(await fileExists(getAssetFileUri(asset.filename, sourcePaths)))) {
      counts.cloudOnly += 1;
      continue;
    }
    const match = asset.mediaLibraryAssetId ? targetByMediaId.get(asset.mediaLibraryAssetId) : undefined;
    if (match) {
      assetIdMap.set(asset.id, match.id);
      counts.alreadyInAccount += 1;
      const notes = mergedNotes(match.notes, asset.notes);
      const isFavorite = match.isFavorite || asset.isFavorite;
      if (notes !== match.notes || isFavorite !== match.isFavorite)
        duplicates.push({ id: match.id, isFavorite, notes });
      continue;
    }
    assetIdMap.set(asset.id, asset.id);
    assets.push({ ...asset, syncError: null });
    counts.photos += 1;
  }
  await collectReplays('assets', sameIdAssets, targetById);

  // Albums and posts.
  const sourceAlbums = live(await source.select().from(schema.albums)).filter((album) => !album.smartAlbumType);
  const targetAlbums = await readByIdMap<schema.AlbumRow>(
    target,
    schema.albums,
    sourceAlbums.map((a) => a.id),
  );
  const albums = sourceAlbums.filter((album) => !targetAlbums.has(album.id));
  counts.albums = albums.length;
  await collectReplays('albums', sourceAlbums, targetAlbums);

  const sourcePosts = live(await source.select().from(schema.posts));
  const targetPosts = await readByIdMap<schema.PostRow>(
    target,
    schema.posts,
    sourcePosts.map((p) => p.id),
  );
  const posts = sourcePosts.filter((post) => !targetPosts.has(post.id));
  counts.posts = posts.length;
  await collectReplays('posts', sourcePosts, targetPosts);

  // Edges: only between records that will be in the target, re-pointed at matched assets, and not
  // doubling a membership the target already has.
  const parentsInTarget = new Set([...albums, ...sourceAlbums.filter((a) => targetAlbums.has(a.id))].map((a) => a.id));
  const postsInTarget = new Set([...posts, ...sourcePosts.filter((p) => targetPosts.has(p.id))].map((p) => p.id));
  const albumAssets = await planEdges(
    live(await source.select().from(schema.albumAssets)),
    (edge) => edge.albumId,
    parentsInTarget,
    schema.albumAssets,
    schema.albumAssets.albumId,
  );
  const postAssets = await planEdges(
    live(await source.select().from(schema.postAssets)),
    (edge) => edge.postId,
    postsInTarget,
    schema.postAssets,
    schema.postAssets.postId,
  );
  for (const [collection, edges] of [
    ['album_assets', albumAssets],
    ['post_assets', postAssets],
  ] as const) {
    const targetEdges = await readByIdMap<Edge>(
      target,
      schema[collection === 'album_assets' ? 'albumAssets' : 'postAssets'],
      edges.map((edge) => edge.id),
    );
    await collectReplays(collection, edges, targetEdges);
  }

  async function planEdges<E extends Edge>(
    edges: E[],
    parentOf: (edge: E) => string,
    parents: Set<string>,
    table: typeof schema.albumAssets | typeof schema.postAssets,
    parentColumn: typeof schema.albumAssets.albumId | typeof schema.postAssets.postId,
  ): Promise<E[]> {
    const candidates = edges.filter((edge) => parents.has(parentOf(edge)) && assetIdMap.has(edge.assetId));
    if (candidates.length === 0) return [];
    const byId = await readByIdMap<E>(
      target,
      table,
      candidates.map((edge) => edge.id),
    );
    const existing = new Set(
      (
        await target
          .select()
          .from(table)
          .where(and(inArray(parentColumn, [...new Set(candidates.map(parentOf))]), isNull(table.deletedAt)))
      ).map((edge) => `${parentOf(edge as unknown as E)}:${edge.assetId}`),
    );
    const planned: E[] = [];
    for (const edge of candidates) {
      if (byId.has(edge.id)) continue;
      const assetId = assetIdMap.get(edge.assetId)!;
      if (existing.has(`${parentOf(edge)}:${assetId}`)) continue;
      existing.add(`${parentOf(edge)}:${assetId}`);
      planned.push({ ...edge, assetId });
    }
    return planned;
  }

  const nothingLeftToAdd =
    assets.length + albums.length + posts.length + albumAssets.length + postAssets.length === 0 &&
    duplicates.length === 0 &&
    replays.length === 0;
  return {
    counts,
    assets,
    albums,
    posts,
    albumAssets,
    postAssets,
    duplicates,
    replays,
    sameIdAssets,
    nothingLeftToAdd,
  };
}

function mergedNotes(target: string | null, source: string | null): string | null {
  if (!source || (target ?? '').includes(source)) return target;
  return target ? `${target}\n${source}` : source;
}

/** Writes the plan into the target in one transaction: every copied record gets its outbox row. */
export async function applyMerge(target: SyncDb, plan: MergePlan): Promise<void> {
  await target.transaction(async (tx) => {
    await saveRecords(tx, 'assets', schema.assets, plan.assets, { isNew: true });
    await saveRecords(tx, 'albums', schema.albums, plan.albums, { isNew: true });
    await saveRecords(tx, 'posts', schema.posts, plan.posts, { isNew: true });
    await saveRecords(tx, 'album_assets', schema.albumAssets, plan.albumAssets, { isNew: true });
    await saveRecords(tx, 'post_assets', schema.postAssets, plan.postAssets, { isNew: true });
    if (plan.duplicates.length > 0) {
      const changes = new Map(plan.duplicates.map((d) => [d.id, d]));
      const rows = (await readByIds<AssetRow>(tx, schema.assets, [...changes.keys()])).map((row) => ({
        ...row,
        ...changes.get(row.id)!,
        updatedAt: Math.max(Date.now(), row.updatedAt + 1),
      }));
      await saveRecords(tx, 'assets', schema.assets, rows);
    }
    for (const row of plan.replays) {
      await enqueueMutations(tx, row.collection, [
        row.payload as { id: string; updatedAt: number; deletedAt?: number | null },
      ]);
    }
  });
}

/**
 * Moves the files and thumbnails of `assets` (source assets the target has by the same id) from
 * the source's folders into the target's, each only when the target lacks it and the source has
 * it, so a second pass moves nothing and deletes nothing. Returns how many files moved.
 */
export async function moveMergedFiles(
  assets: { filename: string; thumbnailFilename: string }[],
  sourcePaths: LibraryPaths,
  targetPaths: LibraryPaths,
): Promise<number> {
  let moved = 0;
  for (const asset of assets) {
    const files = [
      [getAssetFileUri(asset.filename, sourcePaths), getAssetFileUri(asset.filename, targetPaths)],
      [
        getAssetThumbnailUri(asset.thumbnailFilename, sourcePaths),
        getAssetThumbnailUri(asset.thumbnailFilename, targetPaths),
      ],
    ];
    for (const [from, to] of files) {
      if (await fileExists(to)) continue;
      if (!(await fileExists(from))) continue;
      await moveFile(from, to);
      moved += 1;
    }
  }
  return moved;
}

/** Whether the target would get anything, or has something to say about what it won't. */
export function isEmptyPlan({ counts }: MergePlan): boolean {
  return counts.photos + counts.albums + counts.posts + counts.alreadyInAccount + counts.cloudOnly === 0;
}
