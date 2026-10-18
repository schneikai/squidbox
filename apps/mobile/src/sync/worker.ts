import type { PushMutation, PushResult } from '@squidbox/shared';
import { and, gt } from 'drizzle-orm';

import { unsharedFiles, type RemoveFiles } from './assetsRepository';
import { clientCollectionTables } from './clientCollections';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import {
  clearOutboxRows,
  outboxUpdatedAts,
  pendingRecordIds,
  pushableOutboxRows,
  retryFailures,
  setOutboxError,
} from './outbox';
import { planPushOutcome } from './pushPlan';
import { readByIds } from './readByIds';
import { pauseRuns, startRun } from './runGate';
import { createSingleFlight } from './singleFlight';
import { getCursor, setCursor, patchStatus, appendSyncLog, markFirstSyncDone, clearFirstSyncDone } from './status';
import type { SyncTransport } from './transport';
import { upsertRows } from './upsertRows';
import type { AssetFileNames } from '../library/fs';
import type { LibraryPaths } from '../library/libraryPaths';
import type { SyncIdentity } from '../library/sessionMatches';

const PULL_LIMIT = 1000; // server/contract cap
const PUSH_BATCH = 500; // server caps pushRequest mutations at 500
// Records per apply transaction (and per bulk-action transaction, see writeInBatches). Each
// transaction writes every database page it touches once more (the rollback journal), and with random
// ids a transaction touches most index pages, so a few big transactions are much faster than one per
// page: on web, a 50k first sync drops from ~3 min to ~40 s.
export const APPLY_BATCH = 5000;

// An aborted `signal` ends the run between push batches, or in a pull after the page at hand, with
// everything so far committed (the cursor moves per applied batch, so the next run resumes).
// `removeFiles` removes this device's copies of assets purged elsewhere, before the purge commits (§7a).
interface SyncRunOptions {
  signal?: AbortSignal;
  removeFiles?: RemoveFiles;
}

// ── DI core: one push→pull pass against an injected db + transport, recording a sync_log entry
// (counts, duration, conflict notes, error). Testable off-device (better-sqlite3 + an in-process
// transport). No single-flight/looping here — that's the production wrapper below.
export async function runSyncOnce(
  db: SyncDb,
  transport: SyncTransport,
  { signal = new AbortController().signal, removeFiles = async () => {} }: SyncRunOptions = {},
): Promise<void> {
  const ranAt = Date.now();
  let pushed = 0;
  let pulled = 0;
  const notes: string[] = [];
  let error: string | null = null;
  try {
    const p = await pushPhase(db, transport, signal, removeFiles);
    pushed = p.pushed;
    notes.push(...p.notes);
    if (p.stopped) notes.push('stopped during push');
    else {
      const pull = await pullPhase(db, transport, signal, removeFiles);
      pulled = pull.pulled;
      if (pull.stopped) notes.push('stopped during pull');
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    await appendSyncLog(db, {
      ranAt,
      pushed,
      pulled,
      durationMs: Date.now() - ranAt,
      error,
      notes: notes.length ? notes.join('\n') : null,
    });
  }
}

async function pushPhase(
  db: SyncDb,
  transport: SyncTransport,
  signal: AbortSignal,
  removeFiles: RemoveFiles,
): Promise<{ pushed: number; notes: string[]; stopped: boolean }> {
  let pushed = 0;
  const notes: string[] = [];
  let lastId = 0;
  let stopped = false;
  for (;;) {
    if (signal.aborted) {
      stopped = true;
      break;
    }
    const batch = await db
      .select()
      .from(schema.outbox)
      .where(and(gt(schema.outbox.id, lastId), pushableOutboxRows))
      .orderBy(schema.outbox.id)
      .limit(PUSH_BATCH);
    if (batch.length === 0) break;
    if (pushed === 0) await patchStatus(db, { phase: 'pushing' });
    lastId = batch[batch.length - 1]!.id;

    const mutations: PushMutation[] = batch.map((row) => ({
      collection: row.collection,
      record: row.payload,
      fields: row.fields ?? undefined,
    }));
    const { results } = await transport.push({ mutations });
    // A purge that beat this device's edit comes back as the current record to adopt.
    await removeNewlyPurgedFiles(
      db,
      results.filter((result) => result.collection === 'assets').map((result) => result.current),
      removeFiles,
    );
    const pushedUpdatedAt = new Map(batch.map((row) => [`${row.collection}:${row.recordId}`, row.updatedAt]));
    notes.push(...(await db.transaction((tx) => applyPushResults(tx, results, pushedUpdatedAt))));
    pushed += results.length;
  }
  if (pushed > 0) await patchStatus(db, { lastPushAt: Date.now() });
  return { pushed, notes, stopped };
}

// Settle a batch's push results (sync-design §6), a few statements per collection. Adopting the
// server's record is the one step that can fail on bad data, so each runs in its own savepoint: a
// failure keeps that record's outbox row and flags it, instead of rolling back the batch and
// stalling every later sync. A flagged row waits (§6). Returns the notes for the sync log.
async function applyPushResults(
  tx: SyncDb,
  results: PushResult[],
  pushedUpdatedAt: Map<string, number>,
): Promise<string[]> {
  const notes: string[] = [];
  for (const [collection, group] of groupByCollection(results)) {
    const current = await outboxUpdatedAts(
      tx,
      collection,
      group.map((result) => result.id),
    );
    const cleared: string[] = [];
    const errors = new Map<string, string[]>(); // error → record ids
    const flag = (id: string, error: string) => pushTo(errors, error, id);

    for (const result of group) {
      const plan = planPushOutcome({
        status: result.status,
        pushedUpdatedAt: pushedUpdatedAt.get(`${collection}:${result.id}`) ?? 0,
        currentOutboxUpdatedAt: current.get(result.id) ?? null,
      });
      if (plan.adoptCurrent && result.current) {
        try {
          await tx.transaction((savepoint) => applyRecord(savepoint, collection, result.current!));
          // Conflict/rebase visibility (sync-design §13): a local change lost LWW and was overwritten.
          notes.push(`${collection} ${result.id}: local change overwritten by server`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          flag(result.id, message);
          notes.push(`${collection} ${result.id}: push result not applied (${message})`);
          continue;
        }
      }
      if (plan.clearOutbox) cleared.push(result.id);
      if (plan.flagRejected) {
        flag(result.id, result.reason ?? 'rejected');
        notes.push(`${collection} ${result.id}: rejected (${result.reason ?? 'unknown'})`);
      }
    }

    await clearOutboxRows(tx, collection, cleared);
    for (const [error, ids] of errors) await setOutboxError(tx, collection, ids, error);
  }
  return notes;
}

function groupByCollection(results: PushResult[]): Map<string, PushResult[]> {
  const groups = new Map<string, PushResult[]>();
  for (const result of results)
    (groups.get(result.collection) ?? groups.set(result.collection, []).get(result.collection)!).push(result);
  return groups;
}

function pushTo<K, V>(lists: Map<K, V[]>, key: K, value: V): void {
  const list = lists.get(key);
  if (list) list.push(value);
  else lists.set(key, [value]);
}

// Downloads the next batch while applying one; a stop ends the run after the batch at hand, which
// commits with its cursor.
async function pullPhase(
  db: SyncDb,
  transport: SyncTransport,
  signal: AbortSignal,
  removeFiles: RemoveFiles,
): Promise<{ pulled: number; stopped: boolean }> {
  await patchStatus(db, { phase: 'pulling' });
  if (signal.aborted) return { pulled: 0, stopped: true };
  let cursor = await getCursor(db);
  let pulled = 0;
  // Ends a download ahead once the run stops or an apply fails.
  let ended = false;
  const stop = () => ended || signal.aborted;
  let next: Promise<PulledBatch> | null = fetchBatch(transport, cursor, stop);
  try {
    while (next) {
      const batch: PulledBatch = await next;
      next = batch.hasMore && !signal.aborted ? fetchBatch(transport, batch.cursor, stop) : null;
      next?.catch(() => {}); // awaited next round, unless this apply fails or the run stops
      await removeNewlyPurgedFiles(db, batch.changes.assets, removeFiles);
      if (batch.buffered > 0 || batch.cursor !== cursor) pulled += await applyChanges(db, batch.changes, batch.cursor);
      cursor = batch.cursor;
      if (batch.hasMore && signal.aborted) return { pulled, stopped: true };
    }
  } finally {
    ended = true;
    await next?.catch(() => {}); // no request outlives the run
  }
  // The initial full pull has drained — the app can leave the "Setting up…" gate.
  await markFirstSyncDone(db);
  await patchStatus(db, { phase: 'idle', lastPullAt: Date.now() });
  return { pulled, stopped: false };
}

interface PulledBatch {
  changes: Record<string, Record<string, unknown>[]>;
  buffered: number;
  cursor: number;
  hasMore: boolean;
}

// Pages from `cursor` until APPLY_BATCH records, the end, or `stop()` after a page.
async function fetchBatch(transport: SyncTransport, cursor: number, stop: () => boolean): Promise<PulledBatch> {
  const changes: Record<string, Record<string, unknown>[]> = {};
  let buffered = 0;
  let hasMore: boolean;
  do {
    const page = await transport.pull({ cursor, limit: PULL_LIMIT });
    for (const name of Object.keys(clientCollectionTables)) {
      const records = page.changes[name]?.records ?? [];
      (changes[name] ??= []).push(...records);
      buffered += records.length;
    }
    cursor = page.cursor;
    hasMore = page.hasMore;
  } while (hasMore && buffered < APPLY_BATCH && !stop());
  return { changes, buffered, cursor, hasMore };
}

// Outbox-guarded apply (sync-design §5): apply an incoming record only if it has no pending
// local mutation. Never timestamp-compare against committed local state. The records of several
// pages and their cursor commit in one transaction. Returns the number of records actually applied.
async function applyChanges(
  db: SyncDb,
  changes: Record<string, Record<string, unknown>[]>,
  cursor: number,
): Promise<number> {
  return db.transaction(async (tx) => {
    let applied = 0;
    for (const [name, table] of Object.entries(clientCollectionTables)) {
      if (changes[name].length === 0) continue;
      const pending = await pendingRecordIds(tx, name);
      const incoming = changes[name].filter((record) => !pending.has(String(record.id))); // local edits re-assert via push
      await upsertRows(tx, name, table, incoming);
      applied += incoming.length;
    }
    await setCursor(tx, cursor);
    return applied;
  });
}

// The files of the purged assets among these records that aren't purged here yet, so an echo or an
// asset this device never had costs no file work, and only the names no other asset uses (§7a).
async function removeNewlyPurgedFiles(
  db: SyncDb,
  records: (Record<string, unknown> | undefined)[],
  removeFiles: RemoveFiles,
): Promise<void> {
  const ids = records.flatMap((record) => (record?.purgedAt != null ? [String(record.id)] : []));
  if (ids.length === 0) return;
  const rows = (await readByIds<schema.AssetRow>(db, schema.assets, ids)).filter((row) => row.purgedAt === null);
  if (rows.length > 0) await removeFiles(await unsharedFiles(db, rows));
}

async function applyRecord(db: SyncDb, collection: string, record: Record<string, unknown>): Promise<void> {
  const table = clientCollectionTables[collection];
  if (table) await upsertRows(db, collection, table, [record]);
}

// ── Dev/Inspector operations ────────────────────────────────────────────────
/** Delete all pending outbox rows (dev). Can strand never-pushed local records. */
export async function clearOutbox(db: SyncDb): Promise<void> {
  await db.delete(schema.outbox);
}

/**
 * Full resync (sync-design §13): wipe the collection tables, the cursor and the first-sync flag (the
 * setup gate shows again), then re-run sync (push any pending, then a fresh full pull from
 * cursor=0). The outbox stays and its edits are put back, since the pull skips records with an
 * outbox row and one the server keeps rejecting would otherwise vanish from the app. Warn on a
 * non-empty outbox before calling (this rebuilds local state from the server).
 */
export async function fullResync(db: SyncDb, transport: SyncTransport, options: SyncRunOptions = {}): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of Object.values(clientCollectionTables)) await tx.delete(table);
    await setCursor(tx, 0);
    await clearFirstSyncDone(tx);
    for (const row of await tx.select().from(schema.outbox)) {
      const table = clientCollectionTables[row.collection];
      if (table) await upsertRows(tx, row.collection, table, [row.payload]);
    }
  });
  await runSyncOnce(db, transport, options);
}

// ── Production wrapper: one sync at a time (see singleFlight) for the target App.js sets: the open
// library's database and the identity of its signed-in owner, or null while nothing may sync (the
// boot not done, nobody signed in, a library switching). requestSync() is called after a local
// write (from a provider) or on foreground/interval, and is a no-op without a target.
export interface SyncTarget {
  db: SyncDb;
  identity: SyncIdentity;
  library: LibraryPaths;
}

const syncFlight = createSingleFlight(() => withSyncRun(runSyncOnce));
let syncTarget: SyncTarget | null = null;

export function setSyncTarget(target: SyncTarget | null): void {
  syncTarget = target;
  if (target) syncFlight.request();
}

// On the app's return to the foreground: the failed pushes get another try (§6), then a sync. A
// launch's retry is the library open's (library/current.ts). The suspended app may have been resident
// for days, and a failed row also keeps the pull from updating its record.
export function retryFailuresAndSync(): void {
  if (!syncTarget) return;
  syncFlight
    .exclusive(async () => {
      if (syncTarget) await retryFailures(syncTarget.db);
    })
    .catch((error) => console.warn('Could not retry the failed pushes', error));
  syncFlight.request();
}

export function requestSync(): void {
  if (syncTarget) syncFlight.request();
}

// Run `work` with syncing paused: aborts the running sync (it stops at its next batch or page) and backup
// (at its next step), waits for both, and starts no run until `work` finishes. Use it for anything
// that must not interleave with them, like changing the session or the open library. Sections run
// one after another, with the sync requests made meanwhile honored after.
export function withSyncPaused<T>(work: () => Promise<T>): Promise<T> {
  const pause = pauseRuns();
  return syncFlight
    .exclusive(async () => {
      await pause.stopped;
      return work();
    })
    .finally(pause.resume);
}

type SyncWork = (db: SyncDb, transport: SyncTransport, options: SyncRunOptions) => Promise<void>;

// Bind a run to the target of its start, over a transport that reads the tokens fresh for that
// identity on every request (so a mid-run refresh is picked up and another user's session is
// refused, which ends the run like an abort), and record the run's terminal status (idle on
// success, error on throw). Callers run it through syncFlight so it never overlaps another sync.
async function withSyncRun(work: SyncWork): Promise<void> {
  if (!syncTarget) return;
  const { db, identity, library } = syncTarget;
  // Their session store and file system need the native modules the tests lack.
  const { httpTransport } = await import('./transport');
  const { removeAssetFiles } = await import('../library/fs');
  const removeFiles = (assets: AssetFileNames[]) => removeAssetFiles(assets, library);
  const run = startRun((signal) => work(db, httpTransport(identity), { signal, removeFiles }));
  if (!run) return;
  try {
    await run;
    await patchStatus(db, { phase: 'idle', lastError: null });
  } catch (err) {
    await patchStatus(db, { phase: 'error', lastError: err instanceof Error ? err.message : String(err) });
  }
}

// Bound Inspector actions (the open library + HTTP transport).
export function runFullResync(): Promise<void> {
  return syncFlight.exclusive(() => withSyncRun(fullResync));
}
export function runClearOutbox(db: SyncDb): Promise<void> {
  return withSyncPaused(() => clearOutbox(db));
}
