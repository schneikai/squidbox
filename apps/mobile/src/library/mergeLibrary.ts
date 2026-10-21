import {
  assetCollection,
  chunk,
  clockedFields,
  collectionsByName,
  mergeRecord,
  type FieldClocks,
} from '@squidbox/shared';
import { and, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { fileExists, listFiles, moveFile } from './fs';
import type { LibraryPaths } from './libraryPaths';

import { clientCollectionTables } from '@/sync/clientCollections';
import { nextVersion } from '@/sync/clock';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { pendingEdits } from '@/sync/outbox';
import { readByIdMap, readByIds } from '@/sync/readByIds';
import { saveRecords } from '@/sync/saveRecords';
import { getMergeTarget, getReplayedThrough, setReplayedThrough } from '@/sync/status';
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
  // Source outbox rows for records the target already has: the target's row with what applies, and its clocks.
  replays: schema.OutboxRow[];
  // The source and the newest clock of its outbox: a pass's commit records it in the target, and a
  // pass run again replays only the source's fields edited since.
  replayed: { source: string; through: number };
  // What is still in the source's folders of the assets the target has (by id, once applied).
  files: string[];
  thumbnails: string[];
  keepsSource: boolean; // a photo whose file is in another account's storage stays in the source
}

const FILE_OPS = 50; // file-system calls in flight at once

const live = <R extends { deletedAt: number | null }>(rows: R[]) => rows.filter((row) => row.deletedAt === null);

// A purge that waits for the server: the pending edit names the final field (sync-design §7a). The
// sweep's SQL states the same rule (`pendingPurge` in sync/sweepPurgedFiles.ts).
const purgeWaits = (final: string | undefined, fields: FieldClocks = {}) => final !== undefined && final in fields;

/**
 * What adding `source` (this device's library) to `target` (the account's) would do, without
 * writing anything. Tombstones are left behind, unless an earlier pass copied the source into an
 * account (its merge marker): then they may be in the account and are carried too, with their
 * files. A record the target has by id is skipped (its pending edits are replayed field by field);
 * an asset the target has from the same camera-roll item is matched instead of copied; an asset whose
 * file lives in another account's storage stays; smart albums are the account's own; edges follow
 * their asset and parent and are dropped with them.
 */
export async function planMerge(source: SyncDb, target: SyncDb, sourcePaths: LibraryPaths): Promise<MergePlan> {
  const replays: schema.OutboxRow[] = [];
  const sourceOutbox = await source.select().from(schema.outbox);
  const copiedBefore = Boolean(await getMergeTarget(source));
  // The source's outbox is never cleared, so a pass run again (a crash, a resumed merge) would replay
  // what an earlier commit did over what the account changed since: only newer clocks replay.
  const replayedThrough = await getReplayedThrough(target, sourcePaths.dbName);
  const newestClock = Math.max(replayedThrough, ...sourceOutbox.flatMap((row) => Object.values(row.fields)));
  const carried = <R extends Row>(rows: R[]) => (copiedBefore ? rows : live(rows));
  let pendingAssets = new Map<string, FieldClocks>(); // the target's, by asset id (for the files)

  // A source outbox row for a record the target has is merged into the target's row as the server
  // would merge it (mergeRecord, sync-design §7), against the target's pending edits (a field the
  // target hasn't edited goes to the source, and the server settles it); what applies is replayed
  // with the source's clocks. The target's pending fields are read for the records replayed, and for
  // every asset it has (for the files).
  async function collectReplays(collection: string, targetRows: Map<string, Row>) {
    const candidates = sourceOutbox.filter((row) => row.collection === collection && targetRows.has(row.recordId));
    const ids = collection === 'assets' ? [...targetRows.keys()] : candidates.map((row) => row.recordId);
    const edits = ids.length > 0 ? await pendingEdits(target, collection, ids, ['fields']) : new Map();
    const pending = new Map<string, FieldClocks>([...edits].map(([id, edit]) => [id, edit.fields]));
    if (collection === 'assets') pendingAssets = pending;
    if (candidates.length === 0) return;
    const descriptor = collectionsByName[collection]!;
    const unedited = Object.fromEntries(clockedFields(descriptor).map((field) => [field, 0]));
    for (const row of candidates) {
      const stored = targetRows.get(row.recordId)!;
      const edited = pending.get(row.recordId);
      const storedClocks = { ...unedited, ...edited };
      // Widened to their groups when saved; a group's members share a clock, so they stay together.
      const sentClocks = Object.fromEntries(Object.entries(row.fields).filter(([, clock]) => clock > replayedThrough));
      if (Object.keys(sentClocks).length === 0) continue;
      const { record, applied } = mergeRecord(descriptor, {
        stored,
        storedClocks,
        sent: row.payload as Row,
        sentClocks,
        storedPurgeFinal: !purgeWaits(descriptor.finalField, edited),
      });
      if (applied.length === 0) continue;
      // The newer clock of the two, so the target's own pending edit isn't set back by the replay.
      const clocks = applied.map((field) => [field, Math.max(sentClocks[field]!, storedClocks[field] ?? 0)]);
      replays.push({ ...row, payload: record, fields: Object.fromEntries(clocks) });
    }
  }

  // Replays consider every source record the target has by id, tombstones included (a deletion
  // made on the device after the copy is an edit too); only live ones are copied, unless carried.
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
    return { fresh: carried(sourceRows).filter((row) => !targetRows.has(row.id)), targetRows };
  }

  // Assets.
  const allSourceAssets = await source.select().from(schema.assets);
  const { fresh: candidates, targetRows: targetById } = await planRecords('assets', schema.assets, allSourceAssets);
  const mediaIds = live(candidates)
    .map((asset) => asset.mediaLibraryAssetId)
    .filter(Boolean);
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
  for (const asset of carried(allSourceAssets)) {
    if (targetById.has(asset.id)) {
      assetIdMap.set(asset.id, asset.id);
      continue;
    }
    if (asset.deletedAt !== null) {
      assetIdMap.set(asset.id, asset.id); // a carried tombstone, copied as it is, with its files
      assets.push({ ...asset, syncError: null });
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

  // The files of the assets that end in the target by the same id (the copied ones, and those the
  // target has unless their purge there is confirmed: the sweep, not a move, settles those, §7a).
  const sourceThumbnails = await listFiles(getAssetThumbnailsDirectory(sourcePaths));
  const assetReplays = new Map(replays.filter((row) => row.collection === 'assets').map((row) => [row.recordId, row]));
  const final = assetCollection.finalField!;
  const confirmedPurge = (id: string) => {
    const replay = assetReplays.get(id);
    const state = (replay?.payload ?? targetById.get(id)) as Record<string, unknown>;
    return state[final] != null && !purgeWaits(final, { ...pendingAssets.get(id), ...replay?.fields });
  };
  const sameId = allSourceAssets.filter((asset) =>
    targetById.has(asset.id) ? !confirmedPurge(asset.id) : assetIdMap.get(asset.id) === asset.id,
  );
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
    new Set(carried(allSourceAlbums).map((album) => album.id)),
  );
  const postAssets = await planEdges(
    'post_assets',
    await source.select().from(schema.postAssets),
    schema.postAssets,
    schema.postAssets.postId,
    (edge) => edge.postId,
    new Set(carried(allSourcePosts).map((post) => post.id)),
  );

  const replayed = { source: sourcePaths.dbName, through: newestClock };
  return {
    assets,
    albums,
    posts,
    albumAssets,
    postAssets,
    duplicates,
    replays,
    replayed,
    files,
    thumbnails,
    keepsSource,
  };
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
    await setReplayedThrough(tx, plan.replayed.source, plan.replayed.through);
    await saveRecords(tx, 'assets', schema.assets, plan.assets, { isNew: true });
    await saveRecords(tx, 'albums', schema.albums, plan.albums, { isNew: true });
    await saveRecords(tx, 'posts', schema.posts, plan.posts, { isNew: true });
    await saveRecords(tx, 'album_assets', schema.albumAssets, plan.albumAssets, { isNew: true });
    await saveRecords(tx, 'post_assets', schema.postAssets, plan.postAssets, { isNew: true });
    if (plan.duplicates.length > 0) {
      const changes = new Map(plan.duplicates.map((d) => [d.id, d]));
      const previous = await readByIds<AssetRow>(tx, schema.assets, [...changes.keys()]);
      await saveRecords(
        tx,
        'assets',
        schema.assets,
        previous.map((row) => nextVersion(row, changes.get(row.id)!)),
        { previous },
      );
    }
    // A replayed edit is written to the target's row as well as its outbox: a push alone would leave
    // the row stale, and the pull keeps a pending record's fields local.
    for (const collection of new Set(plan.replays.map((row) => row.collection))) {
      const replays = plan.replays.filter((row) => row.collection === collection);
      const clocks = new Map(replays.map((row) => [row.recordId, row.fields]));
      await saveRecords(
        tx,
        collection,
        clientCollectionTables[collection]!,
        replays.map((row) => row.payload as Row),
        { clocks },
      );
    }
  });
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
