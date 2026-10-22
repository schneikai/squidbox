import { chunk, collectionsByName, mergeRecord, type FieldClocks } from '@squidbox/shared';
import { and, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { fileExists, listFiles, moveFile } from './fs';
import type { LibraryPaths } from './libraryPaths';

import { setSyncError } from '@/sync/assetsRepository';
import { clientCollectionTables } from '@/sync/clientCollections';
import { nextVersion } from '@/sync/clock';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { pendingEdits } from '@/sync/outbox';
import { readByIdMap } from '@/sync/readByIds';
import { saveRecords } from '@/sync/saveRecords';
import {
  getMergeMarks,
  isFirstSyncDone,
  setMergeCommitted,
  setMergeMarks,
  type MergeDecision,
  type MergeMark,
} from '@/sync/status';
import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';
import getAssetFilesDirectory from '@/utils/assets/files/getAssetFilesDirectory';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
import getAssetThumbnailsDirectory from '@/utils/assets/thumbnails/getAssetThumbnailsDirectory';

type AssetRow = schema.AssetRow;
type Row = { id: string; updatedAt: number; deletedAt: number | null };
type Edge = Row & { assetId: string } & Record<string, unknown>;
type Sent = Pick<schema.OutboxRow, 'payload' | 'fields'>;
type Replay = Pick<schema.OutboxRow, 'collection' | 'recordId' | 'payload' | 'fields'> & { sent: Sent };
// What a device photo merged into a target asset at the commit brings to it.
type Photo = { favorite: boolean; note: string | null };
type MatchFields = Pick<AssetRow, 'isFavorite' | 'notes'>;

export interface MergePlan {
  assets: AssetRow[];
  albums: schema.AlbumRow[];
  posts: schema.PostRow[];
  albumAssets: schema.AlbumAssetRow[];
  postAssets: schema.PostAssetRow[];
  // Target assets that device photos are merged into (camera-roll matches), and what they bring.
  duplicates: { id: string; photos: Photo[] }[];
  // Edits replayed onto records the target has, one per record: the target's row with what applies,
  // and its clocks; `sent` is what was sent, merged again onto the row as it is at the commit.
  replays: Replay[];
  // Per source record, what was decided for it, earlier passes included (sync-design §8).
  marks: { source: string; decided: Record<string, MergeMark> };
  // [source name, target name] of what is still in the source's folders for records that end up in
  // the target: an asset's own (by id, once applied), and the device's copy for a matched record the
  // cloud has none of, under that record's names, as the source goes with its folders.
  files: [string, string][];
  thumbnails: [string, string][];
  // Matched records whose backup failed before: it tries again, with the device's copy.
  retried: string[];
  keepsSource: boolean; // a photo whose file is in another account's storage stays in the source
}

const FILE_OPS = 50; // file-system calls in flight at once

const live = <R extends { deletedAt: number | null }>(rows: R[]) => rows.filter((row) => row.deletedAt === null);

// A purge that waits for the server: the pending edit names the final field (sync-design §7a). The
// sweep's SQL states the same rule (`pendingPurge` in sync/sweepPurgedFiles.ts).
const purgeWaits = (final: string | undefined, fields: FieldClocks = {}) => final !== undefined && final in fields;

/**
 * What adding `source` (this device's library) to `target` (the account's library) would
 * do, without writing anything. Tombstones are left behind; a record the target has by id is
 * skipped (its pending edits are replayed field by field); an asset the target has from the same
 * camera-roll item is matched instead of copied, unless this plan's own replays delete it; an asset
 * whose file lives in another account's storage stays; smart albums are the account's own; edges
 * follow their asset and parent and are dropped with them. Run it once the target's first full pull
 * has drained (mergeWaits). Every file the source holds for a record that ends up in the account is
 * moved into the target's folders unless the cloud has it.
 *
 * Every decision is made once (sync-design §8, "the merge model").
 */
export async function planMerge(source: SyncDb, target: SyncDb, sourcePaths: LibraryPaths): Promise<MergePlan> {
  const name = sourcePaths.dbName;
  const sourceOutbox = await source.select().from(schema.outbox);
  const outboxOf = new Map(sourceOutbox.map((row) => [`${row.collection}:${row.recordId}`, row]));
  const decided = newerOf(await getMergeMarks(source, name), await getMergeMarks(target, name));
  const marks = { ...decided };
  const mark = (collection: string, row: Row, made: MergeDecision) => {
    marks[`${collection}:${row.id}`] = { ...made, at: row.updatedAt };
  };
  // A source record's pending fields edited after its decision, at their own clocks.
  const newEdits = (collection: string, id: string): FieldClocks => {
    const since = decided[`${collection}:${id}`]?.at ?? 0;
    const fields = outboxOf.get(`${collection}:${id}`)?.fields ?? {};
    return Object.fromEntries(Object.entries(fields).filter(([, clock]) => clock > since));
  };

  // Replays, one per record, merged onto the target's row as the server would merge it (replayOnto).
  const replays = new Map<string, Replay>();
  // A target row as this plan's replays leave it.
  const afterReplays = <R extends Row>(collection: string, row: R): R =>
    (replays.get(`${collection}:${row.id}`)?.payload as R | undefined) ?? row;

  // A source record the target has by id: its edits to send are merged into the target's row. The
  // target's pending fields are read for the records replayed, and for every asset it has (for the
  // files), which this returns.
  async function collectReplays(collection: string, sourceRows: Row[], targetRows: Map<string, Row>) {
    const replayable = sourceRows.filter((row) => targetRows.has(row.id));
    const ids = collection === 'assets' ? [...targetRows.keys()] : replayable.map((row) => row.id);
    const pending = await pendingEdits(target, collection, ids, { fields: true });
    for (const sourceRow of replayable) {
      const fields = newEdits(collection, sourceRow.id);
      mark(collection, sourceRow, { as: 'copy' });
      if (Object.keys(fields).length === 0) continue;
      const sent = { payload: outboxOf.get(`${collection}:${sourceRow.id}`)!.payload, fields };
      const replayed = replayOnto(collection, targetRows.get(sourceRow.id)!, pending.get(sourceRow.id)?.fields, sent);
      if (replayed)
        replays.set(`${collection}:${sourceRow.id}`, { collection, recordId: sourceRow.id, ...replayed, sent });
    }
    return pending;
  }

  // Replays consider every source record the target has by id, tombstones included (a deletion
  // made on the device after the copy is an edit too).
  async function planRecords<R extends Row>(collection: string, table: SQLiteTable, sourceRows: R[]) {
    const targetRows = await readByIdMap<R>(
      target,
      table,
      sourceRows.map((row) => row.id),
    );
    const pending = await collectReplays(collection, sourceRows, targetRows);
    return { targetRows, pending };
  }
  // The live records the target has no row of: copied, unless a pass skipped them (a copy whose row
  // is gone is copied again).
  async function freshRecords<R extends Row>(collection: string, table: SQLiteTable, sourceRows: R[]) {
    const { targetRows } = await planRecords(collection, table, sourceRows);
    return live(sourceRows).filter(
      (row) => !targetRows.has(row.id) && decided[`${collection}:${row.id}`]?.as !== 'skip',
    );
  }

  // Assets.
  const allSourceAssets = await source.select().from(schema.assets);
  const { targetRows: targetById, pending: pendingAssets } = await planRecords(
    'assets',
    schema.assets,
    allSourceAssets,
  );
  const candidates = live(allSourceAssets).filter((asset) => !targetById.has(asset.id));
  const mediaIds = candidates.map((asset) => asset.mediaLibraryAssetId).filter(Boolean);
  // The target records an earlier pass merged device photos into.
  const matchedBefore = live(allSourceAssets).flatMap((asset) => {
    const made = decided[`assets:${asset.id}`];
    return made?.as === 'match' ? [made.into] : [];
  });
  const matchesBefore = await readByIdMap<AssetRow>(target, schema.assets, matchedBefore);
  const targetByMediaId = new Map<string, AssetRow>();
  if (mediaIds.length > 0) {
    const rows = await target
      .select()
      .from(schema.assets)
      .where(and(inJson(schema.assets.mediaLibraryAssetId, mediaIds), isNull(schema.assets.deletedAt)));
    // A new match goes only into a record still live once this plan's replays apply.
    for (const row of rows)
      if (afterReplays('assets', row).deletedAt === null) targetByMediaId.set(row.mediaLibraryAssetId, row);
  }
  const sourceFiles = await listFiles(getAssetFilesDirectory(sourcePaths));
  const sourceThumbnails = await listFiles(getAssetThumbnailsDirectory(sourcePaths));
  const matchCopies: [AssetRow, AssetRow][] = []; // [device photo, the record it was merged into]
  const assets: AssetRow[] = [];
  const merged = new Map<string, { row: AssetRow; photos: Photo[] }>(); // merged at the commit, at now
  const assetIdMap = new Map<string, string>(); // source asset id → the id it has in the target
  let keepsSource = false;
  const mergeNow = (row: AssetRow, photo: Photo) => {
    const sofar = merged.get(row.id) ?? { row, photos: [] };
    sofar.photos.push(photo);
    merged.set(row.id, sofar);
  };
  for (const asset of live(allSourceAssets)) {
    if (targetById.has(asset.id)) {
      assetIdMap.set(asset.id, asset.id);
      continue;
    }
    const made = decided[`assets:${asset.id}`];
    const earlier = made?.as === 'match' ? matchesBefore.get(made.into) : undefined;
    if (made?.as === 'match' && earlier) {
      // Merged before: the device's edits since go to that record.
      matchCopies.push([asset, earlier]);
      assetIdMap.set(asset.id, earlier.id);
      mark('assets', asset, made);
      const since = newEdits('assets', asset.id);
      const favorite = 'isFavorite' in since && asset.isFavorite;
      const note = 'notes' in since ? asset.notes : null;
      if (favorite || note) mergeNow(earlier, { favorite, note });
      continue;
    }
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
      mergeNow(match, { favorite: asset.isFavorite, note: asset.notes });
      matchCopies.push([asset, match]);
      continue;
    }
    mark('assets', asset, { as: 'copy' });
    assetIdMap.set(asset.id, asset.id);
    // A file this device holds is uploaded to the account by its backup, whatever the source said.
    const flags = hasFile ? { isFileSynced: false, isThumbnailSynced: false, isSynced: false } : {};
    assets.push({ ...asset, ...flags, syncError: null });
  }
  const purgedMatches = matchCopies.filter(([, match]) => match.purgedAt !== null).map(([, match]) => match.id);
  const pendingMatches = await pendingEdits(target, 'assets', purgedMatches, { fields: true });
  const duplicates = [...merged.values()]
    .filter(({ row, photos }) => Object.keys(matchChanges(row, afterReplays('assets', row), photos)).length > 0)
    .map(({ row, photos }) => ({ id: row.id, photos }));

  // The files of the assets that end in the target by the same id (the copied ones, and those the
  // target has unless their purge there is confirmed: the sweep, not a move, settles those, §7a).
  // purgedAt is the assets' final field (assetCollection.finalField), as purgeWaits takes it.
  const confirmedPurge = (state: { purgedAt?: unknown }, fields: FieldClocks | undefined) =>
    state.purgedAt != null && !purgeWaits('purgedAt', fields);
  const keptById = (id: string) =>
    !confirmedPurge(afterReplays('assets', targetById.get(id)!), {
      ...pendingAssets.get(id)?.fields,
      ...replays.get(`assets:${id}`)?.fields,
    });
  const sameId = allSourceAssets.filter((asset) =>
    targetById.has(asset.id) ? keptById(asset.id) : assetIdMap.get(asset.id) === asset.id,
  );
  const files = new Moves(sourceFiles);
  const thumbnails = new Moves(sourceThumbnails);
  for (const asset of sameId) {
    files.add(asset.filename, asset.filename);
    thumbnails.add(asset.thumbnailFilename, asset.thumbnailFilename);
  }
  // The device's copies of a matched record that the cloud hasn't, under its names, so the record
  // keeps a file once the source goes (its backup uploads it), unless its purge is confirmed; a
  // target's own copy stays (only missing destinations are moved into), and the first of several
  // matching photos gives it.
  const retried = new Set<string>();
  for (const [asset, match] of matchCopies) {
    if (confirmedPurge(match, pendingMatches.get(match.id)?.fields)) continue;
    const fileGiven = !match.isFileSynced && files.add(asset.filename, match.filename);
    const thumbnailGiven = !match.isThumbnailSynced && thumbnails.add(asset.thumbnailFilename, match.thumbnailFilename);
    if ((fileGiven || thumbnailGiven) && match.syncError !== null) retried.add(match.id);
  }

  // Albums and posts.
  const allSourceAlbums = (await source.select().from(schema.albums)).filter((album) => !album.smartAlbumType);
  const albums = await freshRecords('albums', schema.albums, allSourceAlbums);
  const allSourcePosts = await source.select().from(schema.posts);
  const posts = await freshRecords('posts', schema.posts, allSourcePosts);
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
    const fresh = await freshRecords(collection, table, edges);
    const copied = fresh.filter((edge) => parents.has(parentOf(edge)) && assetIdMap.has(edge.assetId));
    if (copied.length === 0) return [];
    const existing = new Set(
      (
        await target
          .select()
          .from(table)
          .where(and(inJson(parentColumn, [...new Set(copied.map(parentOf))]), isNull(table.deletedAt)))
      )
        .map((edge) => afterReplays(collection, edge as unknown as E))
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
    replays: [...replays.values()],
    marks: { source: name, decided: marks },
    files: files.list,
    thumbnails: thumbnails.list,
    retried: [...retried],
    keepsSource,
  };
}

// The replay of a source outbox row (its fields edited since the last commit) onto the target's row,
// as the server would merge it (mergeRecord, sync-design §7), against the target's pending clocks (0
// for a field the target hasn't edited: the server settles it), a pending purge not final. Null when
// nothing applies or changes; the clocks are the newer of the two, so a pending edit isn't set back.
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
function withDuplicates(row: MatchFields, photos: Photo[]): MatchFields {
  return {
    isFavorite: row.isFavorite || photos.some((photo) => photo.favorite),
    notes: photos.map((photo) => photo.note).reduce(mergedNotes, row.notes),
  };
}

// The fields a camera-roll match writes, at now: what its photos bring merged onto the row as this
// plan's replays leave it (`after`), each field they change from the row before the replays or after
// them (a replay at an older clock can lose on the server).
function matchChanges(before: MatchFields, after: MatchFields, photos: Photo[]): Partial<MatchFields> {
  const onBefore = withDuplicates(before, photos);
  const onAfter = withDuplicates(after, photos);
  const fields = (['isFavorite', 'notes'] as const).filter(
    (field) => onBefore[field] !== before[field] || onAfter[field] !== after[field],
  );
  return Object.fromEntries(fields.map((field) => [field, onAfter[field]]));
}

/**
 * Whether adding `source` to `target` has to wait for the target's first full pull: before it, no
 * camera-roll item would match (the account's photo arriving beside the copy), and the records an
 * earlier pass pushed from another library aren't there to replay onto. A source holding nothing
 * doesn't wait.
 */
export async function mergeWaits(source: SyncDb, target: SyncDb): Promise<boolean> {
  return !(await isFirstSyncDone(target)) && !(await isEmpty(source));
}

// A library holding no record, not even a tombstone.
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

// A note appended to another unless it is there already: the same note, or whole lines of it,
// trailing spaces and blank lines aside.
function mergedNotes(target: string | null, source: string | null): string | null {
  const lines = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  if (!source?.trim() || `\n${lines(target ?? '')}\n`.includes(`\n${lines(source)}\n`)) return target;
  return target ? `${target}\n${source}` : source;
}

// [from, to] moves out of a folder: only what it holds, each destination once.
class Moves {
  readonly list: [string, string][] = [];
  private readonly destinations = new Set<string>();
  constructor(private readonly held: Set<string>) {}
  add(from: string, to: string): boolean {
    if (!this.held.has(from) || this.destinations.has(to)) return false;
    this.destinations.add(to);
    this.list.push([from, to]);
    return true;
  }
}

/** Whether the plan writes to the target (a plan with nothing costs nothing to apply or move). */
export function writesTarget(plan: MergePlan): boolean {
  return [
    plan.assets,
    plan.albums,
    plan.posts,
    plan.albumAssets,
    plan.postAssets,
    plan.duplicates,
    plan.replays,
    plan.retried,
  ].some((list) => list.length > 0);
}

/**
 * Writes the plan into the target in one transaction, with its marks and the outbox row the pass is
 * pushed through (sync-design §8). Every copied record gets its outbox row. The replays and the
 * matches' merges are made again onto the rows as they are now, so an edit made on the target since
 * the plan isn't set back.
 */
export async function applyMerge(target: SyncDb, plan: MergePlan): Promise<void> {
  await target.transaction(async (tx) => {
    await saveRecords(tx, 'assets', schema.assets, plan.assets, { isNew: true });
    await saveRecords(tx, 'albums', schema.albums, plan.albums, { isNew: true });
    await saveRecords(tx, 'posts', schema.posts, plan.posts, { isNew: true });
    await setSyncError(tx, plan.retried, null);
    await saveRecords(tx, 'album_assets', schema.albumAssets, plan.albumAssets, { isNew: true });
    await saveRecords(tx, 'post_assets', schema.postAssets, plan.postAssets, { isNew: true });
    const duplicateIds = plan.duplicates.map((duplicate) => duplicate.id);
    const beforeReplays = await readByIdMap<AssetRow>(tx, schema.assets, duplicateIds);
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
    const rows = await readByIdMap<AssetRow>(tx, schema.assets, duplicateIds);
    const next: AssetRow[] = [];
    const clocks = new Map<string, FieldClocks>();
    for (const { id, photos } of plan.duplicates) {
      const before = beforeReplays.get(id);
      const row = rows.get(id);
      if (!before || !row) continue;
      const changes = matchChanges(before, row, photos);
      if (Object.keys(changes).length === 0) continue;
      const written = nextVersion<AssetRow>(row, changes);
      next.push(written);
      clocks.set(id, Object.fromEntries(Object.keys(changes).map((field) => [field, written.updatedAt])));
    }
    await saveRecords(tx, 'assets', schema.assets, next, { clocks });
    await setMergeMarks(tx, plan.marks.source, plan.marks.decided);
    await setMergeCommitted(tx, plan.marks.source);
  });
}

/**
 * Moves the plan's files and thumbnails from the source's folders into the target's, each unless
 * the target has it already, so a second pass moves nothing and deletes nothing. A move whose
 * destination is then missing throws, so the source is never removed on an unverified move.
 */
export async function moveMergedFiles(plan: MergePlan, sourcePaths: LibraryPaths, targetPaths: LibraryPaths) {
  const moves = [
    ...plan.files.map(([from, to]) => [getAssetFileUri(from, sourcePaths), getAssetFileUri(to, targetPaths)]),
    ...plan.thumbnails.map(([from, to]) => [
      getAssetThumbnailUri(from, sourcePaths),
      getAssetThumbnailUri(to, targetPaths),
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
