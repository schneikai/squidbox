import { eq, like, sql } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { newestOutboxId, outboxPushedThrough } from './outbox';
import type { MergeMarker } from '../library/mergeMarker';
import type { Owner } from '../library/owner';

// sync_meta helpers: the pull cursor + a small status blob (surfaced by the Inspector).
const CURSOR_KEY = 'cursor';
const STATUS_KEY = 'status';
const FIRST_SYNC_KEY = 'firstSyncDone'; // '1' once the initial full pull has drained
const OWNER_KEY = 'owner'; // whose library this database is (JSON), so the library list is rebuildable
const MERGE_TARGET_KEY = 'mergedInto'; // the merge marker: the library (and account) a merge pass copied this one's records into
const MARKS_KEY = 'mergeMarks:'; // + a source library's database name (getMergeMarks)
const COMMITTED_KEY = 'mergeCommitted:'; // + a source library's database name (getMergeCommit)
const KEPT_FOR_KEY = 'keptFor'; // the library a kept source library joined (getKeptFor)

export type SyncPhase = 'idle' | 'pushing' | 'pulling' | 'error';
export interface SyncStatus {
  phase: SyncPhase;
  lastPushAt?: number;
  lastPullAt?: number;
  lastError?: string | null;
}

async function getMeta(db: SyncDb, key: string): Promise<string | null> {
  const [row] = await db.select().from(schema.syncMeta).where(eq(schema.syncMeta.key, key));
  return row?.value ?? null;
}

async function deleteMeta(db: SyncDb, key: string): Promise<void> {
  await db.delete(schema.syncMeta).where(eq(schema.syncMeta.key, key));
}

// Writes only when the value changes, so an idle sync pass doesn't wake every sync_meta reader.
async function setMeta(db: SyncDb, key: string, value: string): Promise<void> {
  if ((await getMeta(db, key)) === value) return;
  await db
    .insert(schema.syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.syncMeta.key, set: { value } });
}

export async function getCursor(db: SyncDb): Promise<number> {
  return Number((await getMeta(db, CURSOR_KEY)) ?? 0);
}

// First-sync flag: the initial full pull (the big one after first login) has fully drained. Used to
// gate the app behind a "Setting up your library…" screen while that bulk load runs.
export async function markFirstSyncDone(db: SyncDb): Promise<void> {
  await setMeta(db, FIRST_SYNC_KEY, '1');
}
// Clear the flag so the "Setting up your library…" gate shows again for the next full pull. Used by
// fullResync (a full re-pull is, semantically, another first sync).
export async function clearFirstSyncDone(db: SyncDb): Promise<void> {
  await setMeta(db, FIRST_SYNC_KEY, '0');
}

// The library's owner, as stored in the database itself (library/registry.ts keeps the list).
export async function getOwner(db: SyncDb): Promise<Owner | null> {
  const raw = await getMeta(db, OWNER_KEY);
  return raw ? (JSON.parse(raw) as Owner) : null;
}
export async function setOwner(db: SyncDb, owner: Owner): Promise<void> {
  await setMeta(db, OWNER_KEY, JSON.stringify(owner));
}
// The merge marker in the source library's own database (library/mergeMarker.ts), JSON: set with a
// merge pass that copies its records into another library, cleared only once a merge that keeps the
// source is done. Until then a restore there can beat this library's purges, which keep their files
// (sweepPurgedFiles).
// A bare library id, as earlier builds of this branch (never released) wrote, counts as no marker.
export async function getMergeTarget(db: SyncDb): Promise<MergeMarker | null> {
  const raw = await getMeta(db, MERGE_TARGET_KEY);
  return raw?.startsWith('{') ? (JSON.parse(raw) as MergeMarker) : null;
}
export async function setMergeTarget(db: SyncDb, marker: MergeMarker | null): Promise<void> {
  if (marker) await setMeta(db, MERGE_TARGET_KEY, JSON.stringify(marker));
  else await deleteMeta(db, MERGE_TARGET_KEY);
}
/** What a committed merge pass decided for a source record (`collection:id`, sync-design §8). */
export type MergeDecision = { as: 'copy' } | { as: 'match'; into: string } | { as: 'skip' };
export type MergeMark = MergeDecision & { at: number };

// The marks of a source library (by its database name): in the target, committed with each pass; in
// the source once the target has pushed them (sync-design §8).
export async function getMergeMarks(db: SyncDb, source: string): Promise<Record<string, MergeMark>> {
  const raw = await getMeta(db, `${MARKS_KEY}${source}`);
  return raw ? (JSON.parse(raw) as Record<string, MergeMark>) : {};
}
export async function setMergeMarks(
  db: SyncDb,
  source: string,
  marks: Record<string, MergeMark> | null,
): Promise<void> {
  if (marks) await setMeta(db, `${MARKS_KEY}${source}`, JSON.stringify(marks));
  else await deleteMeta(db, `${MARKS_KEY}${source}`);
}

/**
 * In the target, what a source's committed passes wait for (mergeRun, sync-design §8): the outbox row
 * they are pushed through (the newest at the last commit) and, once that pass's files moved, the
 * source's outbox as it saw it (outboxVersion).
 */
export type MergeCommit = { through: number; source?: string };
const parseCommit = (raw: string | null) => (raw ? (JSON.parse(raw) as MergeCommit) : null);
export async function getMergeCommit(db: SyncDb, source: string): Promise<MergeCommit | null> {
  return parseCommit(await getMeta(db, `${COMMITTED_KEY}${source}`));
}
export async function setMergeCommit(db: SyncDb, source: string, commit: MergeCommit): Promise<void> {
  await setMeta(db, `${COMMITTED_KEY}${source}`, JSON.stringify(commit));
}
// A pass's commit into the target, inside its transaction: its marks, and what it waits for.
export async function commitMergeMarks(tx: SyncDb, source: string, marks: Record<string, MergeMark>): Promise<void> {
  await setMergeMarks(tx, source, marks);
  await setMergeCommit(tx, source, { through: await newestOutboxId(tx) });
}
// The merge finished: the target's commit goes, with its marks.
export async function clearMergeCommit(db: SyncDb, source: string): Promise<void> {
  await db.transaction(async (tx) => {
    await setMergeMarks(tx, source, null);
    await deleteMeta(tx, `${COMMITTED_KEY}${source}`);
  });
}
// Whether the passes of a commit have pushed.
export function isPushed(db: SyncDb, commit: MergeCommit): Promise<boolean> {
  return outboxPushedThrough(db, commit.through);
}
// Whether some source's committed passes have all pushed, its merge left to finish (usePendingMerges).
export async function anyMergePushed(db: SyncDb): Promise<boolean> {
  const rows = await db
    .select()
    .from(schema.syncMeta)
    .where(like(schema.syncMeta.key, `${COMMITTED_KEY}%`));
  for (const { value } of rows) {
    const commit = parseCommit(value);
    if (commit && (await isPushed(db, commit))) return true;
  }
  return false;
}

// The library a source library joined and stays beside (mergeRun), in its own database: with the
// merge marker, the authority the library list is rebuilt from, so it never joins a second account.
export async function getKeptFor(db: SyncDb): Promise<string | null> {
  return getMeta(db, KEPT_FOR_KEY);
}
export async function setKeptFor(db: SyncDb, targetId: string): Promise<void> {
  await setMeta(db, KEPT_FOR_KEY, targetId);
}
export async function isFirstSyncDone(db: SyncDb): Promise<boolean> {
  return (await getMeta(db, FIRST_SYNC_KEY)) === '1';
}
export async function setCursor(db: SyncDb, cursor: number): Promise<void> {
  await setMeta(db, CURSOR_KEY, String(cursor));
}

export async function patchStatus(db: SyncDb, patch: Partial<SyncStatus>): Promise<void> {
  await setMeta(db, STATUS_KEY, JSON.stringify({ ...(await getStatus(db)), ...patch }));
}

export async function getStatus(db: SyncDb): Promise<SyncStatus> {
  const raw = await getMeta(db, STATUS_KEY);
  return { phase: 'idle', ...(raw ? (JSON.parse(raw) as Partial<SyncStatus>) : {}) };
}

const SYNC_LOG_MAX = 100;

export interface SyncLogEntry {
  ranAt: number;
  pushed: number;
  pulled: number;
  durationMs: number;
  error?: string | null;
  notes?: string | null;
}

// Append a run to the sync_log ring buffer, trimming to the most recent SYNC_LOG_MAX rows.
export async function appendSyncLog(db: SyncDb, entry: SyncLogEntry): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(schema.syncLog).values({
      ranAt: entry.ranAt,
      pushed: entry.pushed,
      pulled: entry.pulled,
      durationMs: entry.durationMs,
      error: entry.error ?? null,
      notes: entry.notes ?? null,
    });
    await tx
      .delete(schema.syncLog)
      .where(
        sql`${schema.syncLog.id} <= (select id from ${schema.syncLog} order by id desc limit 1 offset ${SYNC_LOG_MAX})`,
      );
  });
}
