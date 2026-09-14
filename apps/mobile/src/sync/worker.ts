import type { PushMutation, PushResult } from '@squidbox/shared';

import { setSyncError } from './assetsRepository';
import { clientCollectionTables } from './clientCollections';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { pendingRecordIds, clearOutboxRow, getOutboxUpdatedAt } from './outbox';
import { planPushOutcome, chunk } from './pushPlan';
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

const PULL_LIMIT = 1000; // server/contract cap; larger pages = fewer reactive storms on bulk pull
const PUSH_BATCH = 500; // server caps pushRequest mutations at 500

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
    for (const result of results) {
      pushed += 1;
      const note = await applyPushResult(db, result, pushedUpdatedAt.get(`${result.collection}:${result.id}`) ?? 0);
      if (note) notes.push(note);
    }
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
  if (plan.clearError && result.collection === 'assets') await setSyncError(db, result.id, null);
  if (plan.flagRejected) {
    if (result.collection === 'assets') await setSyncError(db, result.id, result.reason ?? 'rejected');
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
    const page = await transport.pull({ cursor, limit: PULL_LIMIT });
    // Apply every registered collection's changes to its local table.
    for (const [name, table] of Object.entries(clientCollectionTables)) {
      pulled += await applyPage(db, name, table, page.changes[name]?.records ?? []);
    }
    cursor = page.cursor;
    await setCursor(db, cursor);
    hasMore = page.hasMore;
  }
  // The initial full pull has drained — the app can leave the "Setting up…" gate.
  await markFirstSyncDone(db);
  await patchStatus(db, { phase: 'idle', lastPullAt: Date.now() });
  return pulled;
}

// Outbox-guarded apply (sync-design §5): apply an incoming record only if it has no pending
// local mutation. Never timestamp-compare against committed local state. One transaction/page.
// Returns the number of records actually applied.
async function applyPage(
  db: SyncDb,
  collection: string,
  table: (typeof clientCollectionTables)[string],
  records: Record<string, unknown>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const pending = await pendingRecordIds(db, collection);
  let applied = 0;
  db.transaction((tx) => {
    for (const record of records) {
      if (pending.has(String(record.id))) continue; // local edit will re-assert via push
      const values = collection === 'assets' ? { ...record, syncError: null } : record;
      (tx as unknown as SyncDb)
        .insert(table)
        .values(values as any)
        .onConflictDoUpdate({ target: (table as any).id, set: record })
        .run();
      applied += 1;
    }
  });
  return applied;
}

async function applyRecord(db: SyncDb, collection: string, record: Record<string, unknown>): Promise<void> {
  const table = clientCollectionTables[collection];
  if (!table) return;
  const values = collection === 'assets' ? { ...record, syncError: null } : record;
  await db
    .insert(table)
    .values(values as any)
    .onConflictDoUpdate({ target: (table as any).id, set: record })
    .run();
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
  db.transaction((tx) => {
    for (const table of Object.values(clientCollectionTables)) (tx as unknown as SyncDb).delete(table).run();
    if (!keepOutbox) (tx as unknown as SyncDb).delete(schema.outbox).run();
  });
  await setCursor(db, 0);
  await clearFirstSyncDone(db);
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

// ── Production wrapper: single-flight + trailing re-run, bound to the real device DB + HTTP
// transport. Sync stays OFF until app init finishes (enableSync) so the first pull can't contend
// with init's DB work and strand the splash. After that, requestSync() is called after a local
// write (from a provider) or on foreground/interval.
let running = false;
let rerun = false;
let syncEnabled = false;

// Turn syncing on once app init has finished, and kick the first pass. Every requestSync() caller
// (post-login, on-mutation, foreground/interval) is a no-op until this runs — one gate, not several.
export function enableSync(): void {
  syncEnabled = true;
  void runSync();
}

export function requestSync(): void {
  if (syncEnabled) void runSync();
}

// Shared run scaffold: hold the single-flight, resolve the real db + transport, and record the run's
// terminal status (idle on success, error on throw). Callers apply their own entry guard first.
async function withSyncRun(work: (db: SyncDb, transport: SyncTransport) => Promise<void>): Promise<void> {
  running = true;
  const { getDb } = await import('./db/client');
  const { httpTransport } = await import('./transport');
  const db = getDb();
  try {
    await work(db, httpTransport);
    await patchStatus(db, { phase: 'idle', lastError: null });
  } catch (err) {
    await patchStatus(db, { phase: 'error', lastError: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

// Bound Inspector actions (production db + HTTP transport).
export async function runFullResync(): Promise<void> {
  // Wait out any in-flight sync so the wipe + cursor reset can't race a concurrent pull, then hold
  // the single-flight for the whole resync (failures surface as phase:'error').
  while (running) await new Promise((resolve) => setTimeout(resolve, 50));
  await withSyncRun((db, transport) => fullResync(db, transport));
}
export async function runClearOutbox(): Promise<void> {
  const { getDb } = await import('./db/client');
  await clearOutbox(getDb());
}
export async function runResetSyncForUser(userId: string): Promise<boolean> {
  const { getDb } = await import('./db/client');
  return resetSyncForUser(getDb(), userId);
}

export async function runSync(): Promise<void> {
  if (running) {
    rerun = true;
    return;
  }
  await withSyncRun(async (db, transport) => {
    do {
      rerun = false;
      await runSyncOnce(db, transport);
    } while (rerun);
  });
}
