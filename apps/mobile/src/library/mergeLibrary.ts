import { and, inArray, isNull } from 'drizzle-orm';

import { fileExists, moveFile } from './fs';
import type { LibraryPaths } from './libraryPaths';

import { chunk } from '@/sync/chunk';
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

export interface MergePlan {
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
  cloudOnly: number; // photos whose file is in another account's storage: they stay in the source
}

const FILE_CHECKS = 50; // stat calls in flight at once

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

  // Assets. Replays consider every source record the target has by id, tombstones included (a
  // deletion made on the device after the copy is an edit too); only live ones are copied.
  const allSourceAssets = await source.select().from(schema.assets);
  const sourceAssets = live(allSourceAssets);
  const targetById = await readByIdMap<AssetRow>(
    target,
    schema.assets,
    allSourceAssets.map((asset) => asset.id),
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
  const withFile = await sourceFilesPresent(
    sourceAssets.filter((asset) => !targetById.has(asset.id)),
    sourcePaths,
  );
  const assets: AssetRow[] = [];
  const sameIdAssets: AssetRow[] = [];
  const merged = new Map<string, { isFavorite: boolean; notes: string | null }>(); // by target asset id
  const matched = new Map<string, AssetRow>(); // the target assets those were merged into
  const assetIdMap = new Map<string, string>(); // source asset id → the id it has in the target
  let cloudOnly = 0;
  for (const asset of sourceAssets) {
    if (targetById.has(asset.id)) {
      assetIdMap.set(asset.id, asset.id);
      sameIdAssets.push(asset);
      continue;
    }
    if (asset.isFileSynced && !withFile.has(asset.id)) {
      cloudOnly += 1;
      continue;
    }
    const match = asset.mediaLibraryAssetId ? targetByMediaId.get(asset.mediaLibraryAssetId) : undefined;
    if (match) {
      assetIdMap.set(asset.id, match.id);
      matched.set(match.id, match);
      // Several source assets can match one target asset: merge them all into it.
      const sofar = merged.get(match.id) ?? { isFavorite: match.isFavorite, notes: match.notes };
      merged.set(match.id, {
        isFavorite: sofar.isFavorite || asset.isFavorite,
        notes: mergedNotes(sofar.notes, asset.notes),
      });
      continue;
    }
    assetIdMap.set(asset.id, asset.id);
    // A file this device holds is uploaded to the account by its backup, whatever the source said.
    const flags = withFile.has(asset.id) ? { isFileSynced: false, isThumbnailSynced: false, isSynced: false } : {};
    assets.push({ ...asset, ...flags, syncError: null });
  }
  const duplicates = [...merged]
    .filter(([id, change]) => {
      const row = matched.get(id)!;
      return change.isFavorite !== row.isFavorite || change.notes !== row.notes;
    })
    .map(([id, change]) => ({ id, ...change }));
  await collectReplays('assets', allSourceAssets, targetById);

  // Albums and posts.
  const allSourceAlbums = (await source.select().from(schema.albums)).filter((album) => !album.smartAlbumType);
  const sourceAlbums = live(allSourceAlbums);
  const targetAlbums = await readByIdMap<schema.AlbumRow>(
    target,
    schema.albums,
    allSourceAlbums.map((a) => a.id),
  );
  const albums = sourceAlbums.filter((album) => !targetAlbums.has(album.id));
  await collectReplays('albums', allSourceAlbums, targetAlbums);

  const allSourcePosts = await source.select().from(schema.posts);
  const sourcePosts = live(allSourcePosts);
  const targetPosts = await readByIdMap<schema.PostRow>(
    target,
    schema.posts,
    allSourcePosts.map((p) => p.id),
  );
  const posts = sourcePosts.filter((post) => !targetPosts.has(post.id));
  await collectReplays('posts', allSourcePosts, targetPosts);

  // Edges: an unpushed edit of an edge the target has (a removal from an album, say) is replayed
  // like a record's; a live edge between records that will be in the target (every live, non-smart
  // parent is) is copied, re-pointed at a matched asset, unless the target has that membership.
  async function planEdges<E extends Edge>(
    edges: E[],
    parentOf: (edge: E) => string,
    parents: Set<string>,
    table: typeof schema.albumAssets | typeof schema.postAssets,
    parentColumn: typeof schema.albumAssets.albumId | typeof schema.postAssets.postId,
    collection: string,
  ): Promise<E[]> {
    const byId = await readByIdMap<E>(
      target,
      table,
      edges.map((edge) => edge.id),
    );
    await collectReplays(collection, edges, byId);
    const fresh = live(edges).filter(
      (edge) => !byId.has(edge.id) && parents.has(parentOf(edge)) && assetIdMap.has(edge.assetId),
    );
    if (fresh.length === 0) return [];
    const existing = new Set(
      (
        await target
          .select()
          .from(table)
          .where(and(inArray(parentColumn, [...new Set(fresh.map(parentOf))]), isNull(table.deletedAt)))
      ).map((edge) => `${parentOf(edge as unknown as E)}:${edge.assetId}`),
    );
    const planned: E[] = [];
    for (const edge of fresh) {
      const assetId = assetIdMap.get(edge.assetId)!;
      if (existing.has(`${parentOf(edge)}:${assetId}`)) continue;
      existing.add(`${parentOf(edge)}:${assetId}`);
      planned.push({ ...edge, assetId });
    }
    return planned;
  }
  const albumAssets = await planEdges(
    await source.select().from(schema.albumAssets),
    (edge) => edge.albumId,
    new Set(sourceAlbums.map((album) => album.id)),
    schema.albumAssets,
    schema.albumAssets.albumId,
    'album_assets',
  );
  const postAssets = await planEdges(
    await source.select().from(schema.postAssets),
    (edge) => edge.postId,
    new Set(sourcePosts.map((post) => post.id)),
    schema.postAssets,
    schema.postAssets.postId,
    'post_assets',
  );

  return { assets, albums, posts, albumAssets, postAssets, duplicates, replays, sameIdAssets, cloudOnly };
}

// The ids of the assets whose file is in the source's folder, checked a few at a time.
async function sourceFilesPresent(assets: AssetRow[], sourcePaths: LibraryPaths): Promise<Set<string>> {
  const present = new Set<string>();
  for (const batch of chunk(assets, FILE_CHECKS)) {
    await Promise.all(
      batch.map(async (asset) => {
        if (await fileExists(getAssetFileUri(asset.filename, sourcePaths))) present.add(asset.id);
      }),
    );
  }
  return present;
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
 * it, so a second pass moves nothing and deletes nothing. A move whose destination is then missing
 * throws, so the source is never removed on an unverified move. Returns how many files moved.
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
      if (!(await fileExists(to))) throw new Error(`Could not move ${from} to ${to}`);
      moved += 1;
    }
  }
  return moved;
}
