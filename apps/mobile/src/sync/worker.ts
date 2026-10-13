import type { PushMutation, PushResult } from '@squidbox/shared';
import { gt } from 'drizzle-orm';

import { setSyncError } from './assetsRepository';
import { clientCollectionTables } from './clientCollections';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { clearOutboxRows, outboxUpdatedAts, pendingRecordIds } from './outbox';
import { planPushOutcome } from './pushPlan';
import { createSingleFlight } from './singleFlight';
import {
  getCursor,
  setCursor,
  patchStatus,
  appendSyncLog,
  markFirstSyncDone,
  clearFirstSyncDone,
  getLastSyncUser,
  setLastSyncUser,
} from './status';
import type { SyncTransport } from './transport';
import { upsertRows } from './upsertRows';

const PULL_LIMIT = 1000; // server/contract cap
const PUSH_BATCH = 500; // server caps pushRequest mutations at 500
// Records per apply transaction. Each transaction writes every database page it touches once more
// (the rollback journal), and with random ids a transaction touches most index pages, so a few big
// transactions are much faster than one per page: on web, a 50k first sync drops from ~3 min to ~40 s.
const APPLY_BATCH = 5000;

// ── DI core: one push→pull pass against an injected db + transport, recording a sync_log entry
// (counts, duration, conflict notes, error). Testable off-device (better-sqlite3 + an in-process
// transport). No single-flight/looping here — that's the production wrapper below.
export async function runSyncOnce(db: SyncDb, transport: SyncTransport): Promise<void> {
  const ranAt = Date.now();
  let pushed = 0;
  let pulled = 0;
  const notes: string[] = [];
  let error: string | null = null;
  try {
    const p = await pushPhase(db, transport);
    pushed = p.pushed;
    notes.push(...p.notes);
    pulled = await pullPhase(db, transport);
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

async function pushPhase(db: SyncDb, transport: SyncTransport): Promise<{ pushed: number; notes: string[] }> {
  let pushed = 0;
  const notes: string[] = [];
  let lastId = 0;
  for (;;) {
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
  return { pushed, notes };
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
    const flag = (id: string, error: string) => (errors.get(error) ?? errors.set(error, []).get(error)!).push(id);

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

async function pullPhase(db: SyncDb, transport: SyncTransport): Promise<number> {
  await patchStatus(db, { phase: 'pulling' });
  let cursor = await getCursor(db);
  let hasMore = true;
  let pulled = 0;
  while (hasMore) {
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
  return pulled;
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
  await runSyncOnce(db, transport);
}

// The one "wipe local sync state" primitive: clear every collection table (+ the outbox unless
// keepOutbox), reset the cursor, and clear the first-sync flag so the next pull starts fresh and the
// setup gate shows again. Backs both the account-switch reset (full wipe) and fullResync (keeps the
// outbox to re-push pending edits).
export async function resetLocalSync(db: SyncDb, { keepOutbox = false } = {}): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of Object.values(clientCollectionTables)) await tx.delete(table);
    if (!keepOutbox) await tx.delete(schema.outbox);
    await setCursor(tx, 0);
    await clearFirstSyncDone(tx);
  });
}

// Reset local sync state iff a DIFFERENT user is signing in (the local DB holds the previous user's
// data + their cursor, which would leak/corrupt for the new account — see sync-design). Records the
// current user either way. Returns true if it wiped. Call on login, before requestSync().
export async function resetSyncForUser(db: SyncDb, userId: string): Promise<boolean> {
  const last = await getLastSyncUser(db);
  const changed = last !== null && last !== userId;
  if (changed) await resetLocalSync(db);
  await setLastSyncUser(db, userId);
  return changed;
}

// ── Production wrapper: one sync at a time (see singleFlight), bound to the real device DB + HTTP
// transport. Syncing is only active once app init has finished AND someone is signed in; App.js
// drives that through setSyncActive. requestSync() is called after a local write (from a provider)
// or on foreground/interval, and is a no-op while inactive.
const syncFlight = createSingleFlight(() => withSyncRun(runSyncOnce));
let syncActive = false;

export function setSyncActive(active: boolean): void {
  syncActive = active;
  if (active) syncFlight.request();
}

export function requestSync(): void {
  if (syncActive) syncFlight.request();
}

// Run `work` with syncing paused: waits for an in-flight sync and starts no new one until `work`
// finishes. Use it for anything that must not interleave with a sync, like switching accounts.
export function withSyncPaused<T>(work: (db: SyncDb) => Promise<T>): Promise<T> {
  return syncFlight.exclusive(async () => {
    const { getDb } = await import('./db/client');
    return work(getDb());
  });
}

// Resolve the real db + transport and record the run's terminal status (idle on success, error on
// throw). Callers run it through syncFlight so it never overlaps another sync.
async function withSyncRun(work: (db: SyncDb, transport: SyncTransport) => Promise<void>): Promise<void> {
  const { getDb } = await import('./db/client');
  const { httpTransport } = await import('./transport');
  const db = getDb();
  try {
    await work(db, httpTransport);
    await patchStatus(db, { phase: 'idle', lastError: null });
  } catch (err) {
    await patchStatus(db, { phase: 'error', lastError: err instanceof Error ? err.message : String(err) });
  }
}

// Bound Inspector actions (production db + HTTP transport).
export function runFullResync(): Promise<void> {
  return syncFlight.exclusive(() => withSyncRun(fullResync));
}
export function runClearOutbox(): Promise<void> {
  return withSyncPaused(clearOutbox);
}
