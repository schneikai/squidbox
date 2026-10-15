import type { PushMutation, PushResult } from '@squidbox/shared';
import { gt } from 'drizzle-orm';

import { setSyncError } from './assetsRepository';
import { clientCollectionTables } from './clientCollections';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { clearOutboxRows, outboxUpdatedAts, pendingRecordIds } from './outbox';
import { planPushOutcome } from './pushPlan';
import { createSingleFlight } from './singleFlight';
import { getCursor, setCursor, patchStatus, appendSyncLog, markFirstSyncDone, clearFirstSyncDone } from './status';
import type { SyncTransport } from './transport';
import { upsertRows } from './upsertRows';

const PULL_LIMIT = 1000; // server/contract cap
const PUSH_BATCH = 500; // server caps pushRequest mutations at 500
// Records per apply transaction (and per bulk-action transaction, see writeInBatches). Each
// transaction writes every database page it touches once more (the rollback journal), and with random
// ids a transaction touches most index pages, so a few big transactions are much faster than one per
// page: on web, a 50k first sync drops from ~3 min to ~40 s.
export const APPLY_BATCH = 5000;

export interface SyncRunOptions {
  // Asked between push batches and between applied pull batches: a true ends the run there, with
  // everything so far committed (the cursor moves per applied batch, so the next run resumes).
  shouldStop?: () => boolean;
}

// ── DI core: one push→pull pass against an injected db + transport, recording a sync_log entry
// (counts, duration, conflict notes, error). Testable off-device (better-sqlite3 + an in-process
// transport). No single-flight/looping here — that's the production wrapper below.
export async function runSyncOnce(db: SyncDb, transport: SyncTransport, options: SyncRunOptions = {}): Promise<void> {
  const shouldStop = options.shouldStop ?? (() => false);
  const ranAt = Date.now();
  let pushed = 0;
  let pulled = 0;
  const notes: string[] = [];
  let error: string | null = null;
  try {
    const p = await pushPhase(db, transport, shouldStop);
    pushed = p.pushed;
    notes.push(...p.notes);
    if (p.stopped) notes.push('stopped during push');
    else {
      const pull = await pullPhase(db, transport, shouldStop);
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
  shouldStop: () => boolean,
): Promise<{ pushed: number; notes: string[]; stopped: boolean }> {
  let pushed = 0;
  const notes: string[] = [];
  let lastId = 0;
  let stopped = false;
  for (;;) {
    if (shouldStop()) {
      stopped = true;
      break;
    }
    const batch = await db
      .select()
      .from(schema.outbox)
      .where(gt(schema.outbox.id, lastId))
      .orderBy(schema.outbox.id)
      .limit(PUSH_BATCH);
    if (batch.length === 0) break;
    if (pushed === 0) await patchStatus(db, { phase: 'pushing' });
    lastId = batch[batch.length - 1]!.id;

    const mutations: PushMutation[] = batch.map((row) => ({ collection: row.collection, record: row.payload }));
    const { results } = await transport.push({ mutations });
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
// stalling every later sync. Returns the notes for the sync log.
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
    const settled: string[] = [];
    const errors = new Map<string, string[]>(); // syncError → record ids
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
      if (plan.clearError) settled.push(result.id);
      if (plan.flagRejected) {
        flag(result.id, result.reason ?? 'rejected');
        notes.push(`${collection} ${result.id}: rejected (${result.reason ?? 'unknown'})`);
      }
    }

    await clearOutboxRows(tx, collection, cleared);
    // syncError is an assets-only local field; other collections' failures show in the sync log.
    if (collection !== 'assets') continue;
    await setSyncError(tx, settled, null);
    for (const [error, ids] of errors) await setSyncError(tx, ids, error);
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

// A stopped pull leaves the batches applied so far committed with their cursor.
async function pullPhase(
  db: SyncDb,
  transport: SyncTransport,
  shouldStop: () => boolean,
): Promise<{ pulled: number; stopped: boolean }> {
  await patchStatus(db, { phase: 'pulling' });
  let cursor = await getCursor(db);
  let hasMore = true;
  let pulled = 0;
  while (hasMore) {
    if (shouldStop()) return { pulled, stopped: true };
    const changes: Record<string, Record<string, unknown>[]> = {};
    const previousCursor = cursor;
    let buffered = 0;
    do {
      const page = await transport.pull({ cursor, limit: PULL_LIMIT });
      for (const name of Object.keys(clientCollectionTables)) {
        const records = page.changes[name]?.records ?? [];
        (changes[name] ??= []).push(...records);
        buffered += records.length;
      }
      cursor = page.cursor;
      hasMore = page.hasMore;
    } while (hasMore && buffered < APPLY_BATCH);
    if (buffered > 0 || cursor !== previousCursor) pulled += await applyChanges(db, changes, cursor);
  }
  // The initial full pull has drained — the app can leave the "Setting up…" gate.
  await markFirstSyncDone(db);
  await patchStatus(db, { phase: 'idle', lastPullAt: Date.now() });
  return { pulled, stopped: false };
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
 * Full resync (sync-design §13): wipe local collection tables + reset the cursor, then re-run
 * sync (push any pending, then a fresh full pull from cursor=0). Warn on a non-empty outbox
 * before calling (pending edits are re-pushed, but this rebuilds local state from the server).
 */
export async function fullResync(db: SyncDb, transport: SyncTransport): Promise<void> {
  // Keep the outbox so pending local edits are re-pushed; a full re-pull is another "first sync".
  await resetLocalSync(db, { keepOutbox: true });
  // Put the pending edits back: the pull skips records with an outbox row, so one the server keeps
  // rejecting would otherwise vanish from the app.
  await db.transaction(async (tx) => {
    for (const row of await tx.select().from(schema.outbox)) {
      const table = clientCollectionTables[row.collection];
      if (table) await upsertRows(tx, row.collection, table, [row.payload]);
    }
  });
  await runSyncOnce(db, transport);
}

// The one "wipe local sync state" primitive: clear every collection table (+ the outbox unless
// keepOutbox), reset the cursor, and clear the first-sync flag so the next pull starts fresh and the
// setup gate shows again. Used by fullResync (keeps the outbox to re-push pending edits).
export async function resetLocalSync(db: SyncDb, { keepOutbox = false } = {}): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of Object.values(clientCollectionTables)) await tx.delete(table);
    if (!keepOutbox) await tx.delete(schema.outbox);
    await setCursor(tx, 0);
    await clearFirstSyncDone(tx);
  });
}

// ── Production wrapper: one sync at a time (see singleFlight), bound to the open library and the
// session it belongs to. Syncing is only active once app init has finished, the library is open AND
// someone is signed in; App.js drives that through setSyncActive. requestSync() is called after a
// local write (from a provider) or on foreground/interval, and is a no-op while inactive.
const syncFlight = createSingleFlight(() => withSyncRun(runSyncOnce));
let syncActive = false;
let stopRequested = false;

export function setSyncActive(active: boolean): void {
  syncActive = active;
  if (active) syncFlight.request();
}

export function requestSync(): void {
  if (syncActive) syncFlight.request();
}

// Run `work` with syncing paused: asks a running sync to stop at its next batch, waits for it, and
// starts no new one until `work` finishes. Use it for anything that must not interleave with a
// sync, like changing the session or the open library.
export function withSyncPaused<T>(work: () => Promise<T>): Promise<T> {
  stopRequested = true;
  return syncFlight.exclusive(async () => {
    stopRequested = false;
    return work();
  });
}

type SyncWork = (db: SyncDb, transport: SyncTransport, options: SyncRunOptions) => Promise<void>;

// Bind a run to the library and session of its start: it runs only when the open library is the
// signed-in account's, over a transport that reads the tokens fresh for that identity on every
// request (so a mid-run refresh is picked up and another user's session is refused), and records
// the run's terminal status (idle on success, error on throw). Callers run it through syncFlight so
// it never overlaps another sync.
async function withSyncRun(work: SyncWork): Promise<void> {
  const { getDb } = await import('./db/client');
  const { httpTransport } = await import('./transport');
  const { syncIdentityAsync } = await import('../library/syncIdentityAsync');
  const identity = await syncIdentityAsync();
  if (!identity) return;
  const db = getDb();
  try {
    await work(db, httpTransport(identity), { shouldStop: () => stopRequested });
    await patchStatus(db, { phase: 'idle', lastError: null });
  } catch (err) {
    // A session that changed under the run ended it, like a stop request; that is not an error.
    const { SessionChangedError } = await import('@/utils/cloud-api/requireSessionAsync');
    if (err instanceof SessionChangedError) await patchStatus(db, { phase: 'idle' });
    else await patchStatus(db, { phase: 'error', lastError: err instanceof Error ? err.message : String(err) });
  }
}

// Bound Inspector actions (the open library + HTTP transport).
export function runFullResync(): Promise<void> {
  return syncFlight.exclusive(() => withSyncRun(fullResync));
}
export function runClearOutbox(): Promise<void> {
  return withSyncPaused(async () => {
    const { getDb } = await import('./db/client');
    return clearOutbox(getDb());
  });
}
