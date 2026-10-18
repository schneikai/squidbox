import { and, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { fileExists, listFiles, moveFile } from './fs';
import type { LibraryPaths } from './libraryPaths';

import { chunk } from '@/sync/chunk';
import { clientCollectionTables } from '@/sync/clientCollections';
import { nextVersion } from '@/sync/clock';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { outboxUpdatedAts } from '@/sync/outbox';
import { readByIdMap, readByIds } from '@/sync/readByIds';
import { saveRecords } from '@/sync/saveRecords';
import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';
import getAssetFilesDirectory from '@/utils/assets/files/getAssetFilesDirectory';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
import getAssetThumbnailsDirectory from '@/utils/assets/thumbnails/getAssetThumbnailsDirectory';

type AssetRow = schema.AssetRow;
type Row = { id: string; updatedAt: number; deletedAt: number | null };
type Edge = Row & { assetId: string } & Record<string, unknown>;

export interface MergePlan {
  assets: AssetRow[];
  albums: schema.AlbumRow[];
  posts: schema.PostRow[];
  albumAssets: schema.AlbumAssetRow[];
  postAssets: schema.PostAssetRow[];
  // Target assets that match a source asset by camera-roll item: favorite merged as OR, notes kept.
  duplicates: { id: string; isFavorite: boolean; notes: string | null }[];
  // Source outbox rows for records the target already has, to push with their own updatedAt.
  replays: schema.OutboxRow[];
  // What is still in the source's folders of the assets the target has (by id, once applied).
  files: string[];
  thumbnails: string[];
  keepsSource: boolean; // a photo whose file is in another account's storage stays in the source
}

const FILE_OPS = 50; // file-system calls in flight at once

const live = <R extends { deletedAt: number | null }>(rows: R[]) => rows.filter((row) => row.deletedAt === null);

/**
 * What adding `source` (this device's library) to `target` (the account's) would do, without
 * writing anything. Tombstones are left behind; a record the target has by id is skipped (a
 * pending edit of it is replayed when newer); an asset the target has from the same camera-roll
 * item is matched instead of copied; an asset whose file lives in another account's storage stays;
 * smart albums are the account's own; edges follow their asset and parent and are dropped with them.
 */
export async function planMerge(source: SyncDb, target: SyncDb, sourcePaths: LibraryPaths): Promise<MergePlan> {
  const replays: schema.OutboxRow[] = [];
  const sourceOutbox = await source.select().from(schema.outbox);

  // A source outbox row for a record the target has is worth pushing only when it is newer than
  // what the target holds, in its row and in its own outbox.
  async function collectReplays(collection: string, targetRows: Map<string, { updatedAt: number }>) {
    const candidates = sourceOutbox.filter((row) => row.collection === collection && targetRows.has(row.recordId));
    if (candidates.length === 0) return;
    const pending = await outboxUpdatedAts(
      target,
      collection,
      candidates.map((row) => row.recordId),
    );
    for (const row of candidates) {
      if (row.updatedAt <= targetRows.get(row.recordId)!.updatedAt) continue;
      if ((pending.get(row.recordId) ?? -1) >= row.updatedAt) continue;
      replays.push(row);
    }
  }

  // Replays consider every source record the target has by id, tombstones included (a deletion
  // made on the device after the copy is an edit too); only live ones are copied.
  async function planRecords<R extends Row>(
    collection: string,
    table: SQLiteTable,
    sourceRows: R[],
  ): Promise<{ fresh: R[]; targetRows: Map<string, R> }> {
    const targetRows = await readByIdMap<R>(
      target,
      table,
      sourceRows.map((row) => row.id),
    );
    await collectReplays(collection, targetRows);
    return { fresh: live(sourceRows).filter((row) => !targetRows.has(row.id)), targetRows };
  }

  // Assets.
  const allSourceAssets = await source.select().from(schema.assets);
  const { fresh: candidates, targetRows: targetById } = await planRecords('assets', schema.assets, allSourceAssets);
  const mediaIds = candidates.map((asset) => asset.mediaLibraryAssetId).filter(Boolean);
  const targetByMediaId = new Map<string, AssetRow>();
  if (mediaIds.length > 0) {
    const rows = await target
      .select()
      .from(schema.assets)
      .where(and(inJson(schema.assets.mediaLibraryAssetId, mediaIds), isNull(schema.assets.deletedAt)));
    for (const row of rows) targetByMediaId.set(row.mediaLibraryAssetId, row);
  }
  const sourceFiles = await listFiles(getAssetFilesDirectory(sourcePaths));
  const assets: AssetRow[] = [];
  const merged = new Map<string, { isFavorite: boolean; notes: string | null }>(); // by target asset id
  const matched = new Map<string, AssetRow>(); // the target assets those were merged into
  const assetIdMap = new Map<string, string>(); // source asset id → the id it has in the target
  let keepsSource = false;
  for (const asset of live(allSourceAssets)) {
    if (targetById.has(asset.id)) {
      assetIdMap.set(asset.id, asset.id);
      continue;
    }
    const hasFile = sourceFiles.has(asset.filename);
    if (asset.isFileSynced && !hasFile) {
      keepsSource = true;
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
    const flags = hasFile ? { isFileSynced: false, isThumbnailSynced: false, isSynced: false } : {};
    assets.push({ ...asset, ...flags, syncError: null });
  }
  const duplicates = [...merged]
    .filter(([id, change]) => {
      const row = matched.get(id)!;
      return change.isFavorite !== row.isFavorite || change.notes !== row.notes;
    })
    .map(([id, change]) => ({ id, ...change }));

  // The files of the assets that are in the target by the same id, the copied ones included.
  const sourceThumbnails = await listFiles(getAssetThumbnailsDirectory(sourcePaths));
  const sameId = allSourceAssets.filter((asset) => assetIdMap.get(asset.id) === asset.id);
  const files = sameId.map((asset) => asset.filename).filter((name) => sourceFiles.has(name));
  const thumbnails = sameId.map((asset) => asset.thumbnailFilename).filter((name) => sourceThumbnails.has(name));

  // Albums and posts.
  const allSourceAlbums = (await source.select().from(schema.albums)).filter((album) => !album.smartAlbumType);
  const { fresh: albums } = await planRecords('albums', schema.albums, allSourceAlbums);
  const allSourcePosts = await source.select().from(schema.posts);
  const { fresh: posts } = await planRecords('posts', schema.posts, allSourcePosts);

  // Edges: an unpushed edit of an edge the target has (a removal from an album, say) is replayed
  // like a record's; a live edge between records that will be in the target (every live, non-smart
  // parent is) is copied, re-pointed at a matched asset, unless the target has that membership.
  async function planEdges<E extends Edge>(
    collection: string,
    edges: E[],
    table: typeof schema.albumAssets | typeof schema.postAssets,
    parentColumn: typeof schema.albumAssets.albumId | typeof schema.postAssets.postId,
    parentOf: (edge: E) => string,
    parents: Set<string>,
  ): Promise<E[]> {
    const { fresh } = await planRecords(collection, table, edges);
    const copied = fresh.filter((edge) => parents.has(parentOf(edge)) && assetIdMap.has(edge.assetId));
    if (copied.length === 0) return [];
    const existing = new Set(
      (
        await target
          .select()
          .from(table)
          .where(and(inJson(parentColumn, [...new Set(copied.map(parentOf))]), isNull(table.deletedAt)))
      ).map((edge) => `${parentOf(edge as unknown as E)}:${edge.assetId}`),
    );
    const planned: E[] = [];
    for (const edge of copied) {
      const assetId = assetIdMap.get(edge.assetId)!;
      if (existing.has(`${parentOf(edge)}:${assetId}`)) continue;
      existing.add(`${parentOf(edge)}:${assetId}`);
      planned.push({ ...edge, assetId });
    }
    return planned;
  }
  const albumAssets = await planEdges(
    'album_assets',
    await source.select().from(schema.albumAssets),
    schema.albumAssets,
    schema.albumAssets.albumId,
    (edge) => edge.albumId,
    new Set(live(allSourceAlbums).map((album) => album.id)),
  );
  const postAssets = await planEdges(
    'post_assets',
    await source.select().from(schema.postAssets),
    schema.postAssets,
    schema.postAssets.postId,
    (edge) => edge.postId,
    new Set(live(allSourcePosts).map((post) => post.id)),
  );

  return { assets, albums, posts, albumAssets, postAssets, duplicates, replays, files, thumbnails, keepsSource };
}

function mergedNotes(target: string | null, source: string | null): string | null {
  if (!source || (target ?? '').includes(source)) return target;
  return target ? `${target}\n${source}` : source;
}

/** Whether the plan adds records to the target (a plan with none costs nothing to apply or move). */
export function addsRecords(plan: MergePlan): boolean {
  return [plan.assets, plan.albums, plan.posts, plan.albumAssets, plan.postAssets, plan.duplicates, plan.replays].some(
    (list) => list.length > 0,
  );
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
      const rows = await readByIds<AssetRow>(tx, schema.assets, [...changes.keys()]);
      await saveRecords(
        tx,
        'assets',
        schema.assets,
        rows.map((row) => nextVersion(row, changes.get(row.id)!)),
      );
    }
    // A replayed edit is written to the target's row as well as its outbox: a push alone would leave
    // the row stale, and the pull skips a record with a pending outbox row. Only the fields the
    // source's outbox row names are patched onto the target's row, not the source's stale others.
    for (const collection of new Set(plan.replays.map((row) => row.collection))) {
      const table = clientCollectionTables[collection]!;
      const replays = plan.replays.filter((row) => row.collection === collection);
      const targetRows = await readByIdMap(
        tx,
        table,
        replays.map((row) => row.recordId),
      );
      await saveRecords(
        tx,
        collection,
        table,
        replays.map((row) => replayed(row, targetRows.get(row.recordId))),
      );
    }
  });
}

// A source outbox row's edit applied to the target's row: the fields it changed.
function replayed(row: schema.OutboxRow, target: Row | undefined): Row {
  if (!target) return row.payload as Row;
  const changes = Object.fromEntries(Object.keys(row.fields).map((field) => [field, row.payload[field]]));
  return { ...target, ...changes, updatedAt: row.updatedAt };
}

/**
 * Moves the plan's files and thumbnails from the source's folders into the target's, each unless
 * the target has it already, so a second pass moves nothing and deletes nothing. A move whose
 * destination is then missing throws, so the source is never removed on an unverified move.
 */
export async function moveMergedFiles(plan: MergePlan, sourcePaths: LibraryPaths, targetPaths: LibraryPaths) {
  const moves = [
    ...plan.files.map((name) => [getAssetFileUri(name, sourcePaths), getAssetFileUri(name, targetPaths)]),
    ...plan.thumbnails.map((name) => [
      getAssetThumbnailUri(name, sourcePaths),
      getAssetThumbnailUri(name, targetPaths),
    ]),
  ];
  for (const batch of chunk(moves, FILE_OPS)) {
    await Promise.all(
      batch.map(async ([from, to]) => {
        if (await fileExists(to)) return;
        await moveFile(from, to);
        if (!(await fileExists(to))) throw new Error(`Could not move ${from} to ${to}`);
      }),
    );
  }
}
