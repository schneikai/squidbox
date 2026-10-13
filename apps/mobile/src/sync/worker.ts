import type { PushMutation, PushResult } from '@squidbox/shared';

import { setSyncError } from './assetsRepository';
import { clientCollectionTables } from './clientCollections';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { pendingRecordIds, clearOutboxRow, getOutboxUpdatedAt } from './outbox';
import { planPushOutcome, chunk } from './pushPlan';
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

const PULL_LIMIT = 1000; // server/contract cap; larger pages = fewer reactive storms on bulk pull
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
  const rows = await db.select().from(schema.outbox);
  if (rows.length === 0) return { pushed: 0, notes: [] };
  await patchStatus(db, { phase: 'pushing' });

  const pushedUpdatedAt = new Map<string, number>();
  for (const r of rows) pushedUpdatedAt.set(`${r.collection}:${r.recordId}`, r.updatedAt);

  let pushed = 0;
  const notes: string[] = [];
  for (const batch of chunk(rows, PUSH_BATCH)) {
    const mutations: PushMutation[] = batch.map((r) => ({ collection: r.collection, record: r.payload }));
    const { results } = await transport.push({ mutations });
    await db.transaction(async (tx) => {
      for (const result of results) {
        pushed += 1;
        const pushedAt = pushedUpdatedAt.get(`${result.collection}:${result.id}`) ?? 0;
        // Each result in its own savepoint: one that can't be applied (e.g. a malformed record from
        // the server) keeps its outbox row and is flagged, instead of rolling back the batch and
        // stalling every later sync.
        try {
          const note = await tx.transaction((savepoint) => applyPushResult(savepoint, result, pushedAt));
          if (note) notes.push(note);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (result.collection === 'assets') await setSyncError(tx, [result.id], message);
          notes.push(`${result.collection} ${result.id}: push result not applied (${message})`);
        }
      }
    });
  }
  await patchStatus(db, { lastPushAt: Date.now() });
  return { pushed, notes };
}

async function applyPushResult(db: SyncDb, result: PushResult, pushedUpdatedAt: number): Promise<string | null> {
  const currentOutboxUpdatedAt = await getOutboxUpdatedAt(db, result.collection, result.id);
  const plan = planPushOutcome({ status: result.status, pushedUpdatedAt, currentOutboxUpdatedAt });
  let note: string | null = null;

  if (plan.adoptCurrent && result.current) {
    await applyRecord(db, result.collection, result.current as Record<string, unknown>);
    // Conflict/rebase visibility (sync-design §13): a local change lost LWW and was overwritten.
    note = `${result.collection} ${result.id}: local change overwritten by server`;
  }
  if (plan.clearOutbox) await clearOutboxRow(db, result.collection, result.id);
  // syncError is an assets-only local field.
  if (plan.clearError && result.collection === 'assets') await setSyncError(db, [result.id], null);
  if (plan.flagRejected) {
    if (result.collection === 'assets') await setSyncError(db, [result.id], result.reason ?? 'rejected');
    note = `${result.collection} ${result.id}: rejected (${result.reason ?? 'unknown'})`;
  }
  return note;
}

async function pullPhase(db: SyncDb, transport: SyncTransport): Promise<number> {
  await patchStatus(db, { phase: 'pulling' });
  let cursor = await getCursor(db);
  let hasMore = true;
  let pulled = 0;
  while (hasMore) {
    const changes: Record<string, Record<string, unknown>[]> = {};
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
    pulled += await applyChanges(db, changes, cursor);
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
