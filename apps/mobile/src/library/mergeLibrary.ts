import { assetCollection, chunk, collectionsByName, mergeRecord, type FieldClocks } from '@squidbox/shared';
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
import { getMergeMarks, isFirstSyncDone, setMergeMarks, type MergeMark } from '@/sync/status';
import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';
import getAssetFilesDirectory from '@/utils/assets/files/getAssetFilesDirectory';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
import getAssetThumbnailsDirectory from '@/utils/assets/thumbnails/getAssetThumbnailsDirectory';

type AssetRow = schema.AssetRow;
type Row = { id: string; updatedAt: number; deletedAt: number | null };
type Edge = Row & { assetId: string } & Record<string, unknown>;
type Replay = schema.OutboxRow & { sent: Pick<schema.OutboxRow, 'payload' | 'fields'> };
type Duplicate = {
  id: string;
  isFavorite: boolean;
  notes: string | null;
  from: { favorite: boolean; notes: (string | null)[] };
};

export interface MergePlan {
  assets: AssetRow[];
  albums: schema.AlbumRow[];
  posts: schema.PostRow[];
  albumAssets: schema.AlbumAssetRow[];
  postAssets: schema.PostAssetRow[];
  // Target assets that match a source asset by camera-roll item: favorite merged as OR, notes kept;
  // `from` is what the device's photos bring, merged again onto the row as it is at the commit.
  duplicates: Duplicate[];
  // Source outbox rows for records the target already has: the target's row with what applies, and
  // its clocks; `sent` is the source's row, merged again onto the row as it is at the commit.
  replays: Replay[];
  // Per source record, what was decided for it (the earlier passes' decisions included), recorded in
  // the target with the commit and in the source after it: a pass run again never decides again.
  marks: { source: string; decided: Record<string, MergeMark> };
  // The target hasn't finished its first full pull: nothing is planned (camera-roll matches would
  // find nothing, and the records an earlier library pushed aren't there yet).
  waits: boolean;
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
 * writing anything. Tombstones are left behind; a record the target has by id is skipped (its
 * pending edits are replayed field by field); an asset the target has from the same camera-roll
 * item is matched instead of copied; an asset whose file lives in another account's storage stays;
 * smart albums are the account's own; edges follow their asset and parent and are dropped with them.
 * Nothing is planned before the target's first full pull has drained (`waits`).
 *
 * Every decision is made once: a committed pass records per source record whether it was copied,
 * merged into a target record (a camera-roll match) or skipped (getMergeMarks), and a later pass (a
 * crash, a resumed merge, a new target after the earlier one went) only replays the record's newer
 * edits along that decision: onto the record itself, or onto the match, and nowhere when that is
 * gone. The source's outbox is never cleared; clocks are monotonic per record.
 */
export async function planMerge(source: SyncDb, target: SyncDb, sourcePaths: LibraryPaths): Promise<MergePlan> {
  const name = sourcePaths.dbName;
  if (!(await isFirstSyncDone(target)) && !(await isEmpty(source))) return waitingPlan(name);
  const replays: Replay[] = [];
  const sourceOutbox = await source.select().from(schema.outbox);
  const outboxOf = new Map(sourceOutbox.map((row) => [`${row.collection}:${row.recordId}`, row]));
  const decided = newerOf(await getMergeMarks(source, name), await getMergeMarks(target, name));
  const marks = { ...decided };
  const decision = (collection: string, id: string): MergeMark | undefined => decided[`${collection}:${id}`];
  const mark = (collection: string, row: Row, made: DistributiveOmit<MergeMark, 'at'>) => {
    marks[`${collection}:${row.id}`] = { ...made, at: row.updatedAt } as MergeMark;
  };
  // The fields of a source record edited since its decision (all of an undecided one's pending edit).
  const newEdits = (collection: string, id: string): FieldClocks => {
    const row = outboxOf.get(`${collection}:${id}`);
    const since = decision(collection, id)?.at ?? 0;
    return Object.fromEntries(Object.entries(row?.fields ?? {}).filter(([, clock]) => clock > since));
  };

  // A source record the target has by id: its newer edits are merged into the target's row as the
  // server would merge them (replayOnto). The target's pending fields are read for the records
  // replayed, and for every asset it has (for the files), which this returns.
  async function collectReplays(collection: string, sourceRows: Row[], targetRows: Map<string, Row>) {
    const replayable = sourceRows.filter((row) => targetRows.has(row.id));
    const ids = collection === 'assets' ? [...targetRows.keys()] : replayable.map((row) => row.id);
    const pending = await pendingEdits(target, collection, ids, { fields: true });
    for (const sourceRow of replayable) {
      mark(collection, sourceRow, { as: 'copy' });
      const fields = newEdits(collection, sourceRow.id);
      if (Object.keys(fields).length === 0) continue;
      const row = outboxOf.get(`${collection}:${sourceRow.id}`)!;
      const sent = { payload: row.payload, fields };
      const replay = replayOnto(collection, targetRows.get(sourceRow.id)!, pending.get(sourceRow.id)?.fields, sent);
      if (replay) replays.push({ ...row, ...replay, sent });
    }
    return pending;
  }

  // Replays consider every source record the target has by id, tombstones included (a deletion
  // made on the device after the copy is an edit too); only live, undecided ones are copied.
  async function planRecords<R extends Row>(collection: string, table: SQLiteTable, sourceRows: R[]) {
    const targetRows = await readByIdMap<R>(
      target,
      table,
      sourceRows.map((row) => row.id),
    );
    const pending = await collectReplays(collection, sourceRows, targetRows);
    const fresh = live(sourceRows).filter((row) => !targetRows.has(row.id) && !decision(collection, row.id));
    return { fresh, targetRows, pending };
  }

  // Assets.
  const allSourceAssets = await source.select().from(schema.assets);
  const {
    fresh: candidates,
    targetRows: targetById,
    pending: pendingAssets,
  } = await planRecords('assets', schema.assets, allSourceAssets);
  const mediaIds = candidates.map((asset) => asset.mediaLibraryAssetId).filter(Boolean);
  // The target records an earlier pass merged device photos into: their newer edits go there, while
  // the record is live.
  const matchedBefore = live(allSourceAssets).flatMap((asset) => {
    const made = decision('assets', asset.id);
    return made?.as === 'match' ? [made.into] : [];
  });
  const matchesBefore = await readByIdMap<AssetRow>(target, schema.assets, matchedBefore);
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
  const merged = new Map<string, Duplicate['from']>(); // what the device's photos bring, by target asset id
  const matched = new Map<string, AssetRow>(); // the target assets those were merged into
  const assetIdMap = new Map<string, string>(); // source asset id → the id it has in the target
  let keepsSource = false;
  const mergeInto = (match: AssetRow, from: Duplicate['from']) => {
    matched.set(match.id, match);
    const sofar = merged.get(match.id) ?? { favorite: false, notes: [] };
    sofar.favorite ||= from.favorite;
    sofar.notes.push(...from.notes);
    merged.set(match.id, sofar);
  };
  for (const asset of live(allSourceAssets)) {
    if (targetById.has(asset.id)) {
      assetIdMap.set(asset.id, asset.id);
      continue;
    }
    const made = decision('assets', asset.id);
    if (made?.as === 'match') {
      // Merged before: its newer favorite and notes go to that record, while it is live.
      const match = matchesBefore.get(made.into);
      if (!match || match.deletedAt !== null) continue;
      assetIdMap.set(asset.id, match.id);
      mark('assets', asset, made);
      const since = newEdits('assets', asset.id);
      mergeInto(match, {
        favorite: 'isFavorite' in since && asset.isFavorite,
        notes: 'notes' in since ? [asset.notes] : [],
      });
      continue;
    }
    if (made) continue; // copied before, and the target has it no more (deleted for good, or a resync)
    const hasFile = sourceFiles.has(asset.filename);
    if (asset.isFileSynced && !hasFile) {
      keepsSource = true;
      continue;
    }
    const match = asset.mediaLibraryAssetId ? targetByMediaId.get(asset.mediaLibraryAssetId) : undefined;
    if (match) {
      // Several source assets can match one target asset: merge them all into it.
      assetIdMap.set(asset.id, match.id);
      mark('assets', asset, { as: 'match', into: match.id });
      mergeInto(match, { favorite: asset.isFavorite, notes: [asset.notes] });
      continue;
    }
    mark('assets', asset, { as: 'copy' });
    assetIdMap.set(asset.id, asset.id);
    // A file this device holds is uploaded to the account by its backup, whatever the source said.
    const flags = hasFile ? { isFileSynced: false, isThumbnailSynced: false, isSynced: false } : {};
    assets.push({ ...asset, ...flags, syncError: null });
  }
  const duplicates = [...merged]
    .map(([id, from]) => ({ id, ...withDuplicates(matched.get(id)!, from), from }))
    .filter((d) => d.isFavorite !== matched.get(d.id)!.isFavorite || d.notes !== matched.get(d.id)!.notes);

  // The files of the assets that end in the target by the same id (the copied ones, and those the
  // target has unless their purge there is confirmed: the sweep, not a move, settles those, §7a).
  const sourceThumbnails = await listFiles(getAssetThumbnailsDirectory(sourcePaths));
  const assetReplays = new Map(replays.filter((row) => row.collection === 'assets').map((row) => [row.recordId, row]));
  const final = assetCollection.finalField!;
  const confirmedPurge = (id: string) => {
    const replay = assetReplays.get(id);
    const state = (replay?.payload ?? targetById.get(id)) as Record<string, unknown>;
    return state[final] != null && !purgeWaits(final, { ...pendingAssets.get(id)?.fields, ...replay?.fields });
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
  for (const album of albums) mark('albums', album, { as: 'copy' });
  for (const post of posts) mark('posts', post, { as: 'copy' });

  // Edges: an unpushed edit of an edge the target has (a removal from an album, say) is replayed
  // like a record's; a live edge between records that will be in the target (every live, non-smart
  // parent is) is copied, re-pointed at a matched asset, unless the target has that membership live
  // once this plan's replays apply (a replay may tombstone the edge that has it).
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
    const replayed = new Map(
      replays.filter((row) => row.collection === collection).map((row) => [row.recordId, row.payload as E]),
    );
    const existing = new Set(
      (
        await target
          .select()
          .from(table)
          .where(and(inJson(parentColumn, [...new Set(copied.map(parentOf))]), isNull(table.deletedAt)))
      )
        .map((edge) => replayed.get(edge.id) ?? (edge as unknown as E))
        .filter((edge) => edge.deletedAt === null)
        .map((edge) => `${parentOf(edge)}:${edge.assetId}`),
    );
    const planned: E[] = [];
    for (const edge of copied) {
      const assetId = assetIdMap.get(edge.assetId)!;
      if (existing.has(`${parentOf(edge)}:${assetId}`)) {
        mark(collection, edge, { as: 'skip' }); // the target has the membership: never copied later
        continue;
      }
      existing.add(`${parentOf(edge)}:${assetId}`);
      mark(collection, edge, { as: 'copy' });
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

  return {
    assets,
    albums,
    posts,
    albumAssets,
    postAssets,
    duplicates,
    replays,
    marks: { source: name, decided: marks },
    waits: false,
    files,
    thumbnails,
    keepsSource,
  };
}

// The replay of a source outbox row (its fields edited since the last commit) onto the target's row,
// as the server would merge it (mergeRecord, sync-design §7), against the target's pending clocks (0
// for a field the target hasn't edited: the server settles it), a pending purge not final. Null when
// nothing applies; the clocks are the newer of the two, so a pending edit isn't set back.
function replayOnto(
  collection: string,
  stored: Row,
  pending: FieldClocks | undefined,
  sent: Replay['sent'],
): Pick<schema.OutboxRow, 'payload' | 'fields'> | null {
  const descriptor = collectionsByName[collection]!;
  const storedClocks = { ...Object.fromEntries(descriptor.clockedFields.map((field) => [field, 0])), ...pending };
  const { record, applied } = mergeRecord(descriptor, {
    stored,
    storedClocks,
    sent: sent.payload as Row,
    sentClocks: sent.fields,
    storedPurgeFinal: !purgeWaits(descriptor.finalField, pending),
  });
  if (applied.length === 0) return null;
  const clocks = applied.map((field) => [field, Math.max(sent.fields[field]!, storedClocks[field] ?? 0)]);
  return { payload: record, fields: Object.fromEntries(clocks) };
}

// A matched target asset with what the device's photos bring: favorite as OR, notes appended.
function withDuplicates(
  row: { isFavorite: boolean; notes: string | null },
  from: Duplicate['from'],
): { isFavorite: boolean; notes: string | null } {
  return { isFavorite: row.isFavorite || from.favorite, notes: from.notes.reduce(mergedNotes, row.notes) };
}

// A plan that does nothing: the target hasn't finished its first full pull.
function waitingPlan(source: string): MergePlan {
  return {
    ...{ assets: [], albums: [], posts: [], albumAssets: [], postAssets: [], duplicates: [], replays: [] },
    ...{ marks: { source, decided: {} }, waits: true, files: [], thumbnails: [], keepsSource: false },
  };
}

// A library holding no record, not even a tombstone: nothing to wait for.
async function isEmpty(db: SyncDb): Promise<boolean> {
  for (const table of Object.values(clientCollectionTables)) {
    if ((await db.select().from(table).limit(1)).length > 0) return false;
  }
  return true;
}

// Each record's newer decision of two sets of marks (the source's and the target's).
function newerOf(...sets: Record<string, MergeMark>[]): Record<string, MergeMark> {
  const out: Record<string, MergeMark> = {};
  for (const set of sets)
    for (const [key, made] of Object.entries(set)) if (!out[key] || made.at > out[key].at) out[key] = made;
  return out;
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

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

/**
 * Writes the plan into the target in one transaction: every copied record gets its outbox row, and
 * the source's marks are recorded with it. The replays and the duplicates' merges are made again onto
 * the rows as they are now, so an edit made on the target since the plan isn't set back.
 */
export async function applyMerge(target: SyncDb, plan: MergePlan): Promise<void> {
  await target.transaction(async (tx) => {
    if (plan.waits) return;
    await setMergeMarks(tx, plan.marks.source, plan.marks.decided);
    await saveRecords(tx, 'assets', schema.assets, plan.assets, { isNew: true });
    await saveRecords(tx, 'albums', schema.albums, plan.albums, { isNew: true });
    await saveRecords(tx, 'posts', schema.posts, plan.posts, { isNew: true });
    await saveRecords(tx, 'album_assets', schema.albumAssets, plan.albumAssets, { isNew: true });
    await saveRecords(tx, 'post_assets', schema.postAssets, plan.postAssets, { isNew: true });
    if (plan.duplicates.length > 0) {
      const from = new Map(plan.duplicates.map((d) => [d.id, d.from]));
      const previous = await readByIds<AssetRow>(tx, schema.assets, [...from.keys()]);
      await saveRecords(
        tx,
        'assets',
        schema.assets,
        previous.map((row) => nextVersion(row, withDuplicates(row, from.get(row.id)!))),
        { previous },
      );
    }
    // A replayed edit is written to the target's row as well as its outbox: a push alone would leave
    // the row stale, and the pull keeps a pending record's fields local.
    for (const collection of new Set(plan.replays.map((row) => row.collection))) {
      const table = clientCollectionTables[collection]!;
      const sent = new Map(
        plan.replays.filter((row) => row.collection === collection).map((row) => [row.recordId, row.sent]),
      );
      const ids = [...sent.keys()];
      const stored = await readByIdMap<Row>(tx, table, ids);
      const pending = await pendingEdits(tx, collection, ids, { fields: true });
      const replays = ids.flatMap((id) => {
        const row = stored.get(id);
        const replay = row && replayOnto(collection, row, pending.get(id)?.fields, sent.get(id)!);
        return replay ? [{ id, ...replay }] : [];
      });
      const clocks = new Map(replays.map((replay) => [replay.id, replay.fields]));
      await saveRecords(
        tx,
        collection,
        table,
        replays.map((replay) => replay.payload as Row),
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
