import type { AssetRecord, PushMutation, PushResult } from '@squidbox/shared';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import type { SyncTransport } from './transport';
import { pendingRecordIds, clearOutboxRow, getOutboxUpdatedAt } from './outbox';
import { getCursor, setCursor, patchStatus, appendSyncLog } from './status';
import { setSyncError } from './assetsRepository';
import { planPushOutcome, chunk } from './pushPlan';
import { clientCollectionTables } from './clientCollections';

const PULL_LIMIT = 500;
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

  if (plan.adoptCurrent && result.current && result.collection === 'assets') {
    await applyAssetRecord(db, result.current as unknown as AssetRecord);
    // Conflict/rebase visibility (sync-design §13): a local change lost LWW and was overwritten.
    note = `${result.collection} ${result.id}: local change overwritten by server`;
  }
  if (plan.clearOutbox) await clearOutboxRow(db, result.collection, result.id);
  if (plan.clearError && result.collection === 'assets') await setSyncError(db, result.id, null);
  if (plan.flagRejected && result.collection === 'assets') {
    await setSyncError(db, result.id, result.reason ?? 'rejected');
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
    pulled += await applyPage(db, page.changes.assets?.records ?? []);
    cursor = page.cursor;
    await setCursor(db, cursor);
    hasMore = page.hasMore;
  }
  await patchStatus(db, { phase: 'idle', lastPullAt: Date.now() });
  return pulled;
}

// Outbox-guarded apply (sync-design §5): apply an incoming record only if it has no pending
// local mutation. Never timestamp-compare against committed local state. One transaction/page.
// Returns the number of records actually applied.
async function applyPage(db: SyncDb, records: Array<Record<string, unknown>>): Promise<number> {
  if (records.length === 0) return 0;
  const pending = await pendingRecordIds(db, 'assets');
  let applied = 0;
  db.transaction((tx) => {
    for (const record of records) {
      if (pending.has(String(record.id))) continue; // local edit will re-assert via push
      (tx as unknown as SyncDb)
        .insert(schema.assets)
        .values({ ...(record as AssetRecord), syncError: null })
        .onConflictDoUpdate({ target: schema.assets.id, set: record as AssetRecord })
        .run();
      applied += 1;
    }
  });
  return applied;
}

async function applyAssetRecord(db: SyncDb, record: AssetRecord): Promise<void> {
  await db
    .insert(schema.assets)
    .values({ ...record, syncError: null })
    .onConflictDoUpdate({ target: schema.assets.id, set: record })
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
  db.transaction((tx) => {
    for (const table of Object.values(clientCollectionTables)) {
      (tx as unknown as SyncDb).delete(table).run();
    }
  });
  await setCursor(db, 0);
  await runSyncOnce(db, transport);
}

// ── Production wrapper: single-flight + trailing re-run, bound to the real device DB + HTTP
// transport. Call requestSync() after a local write (from the provider) or on foreground/interval.
let running = false;
let rerun = false;

export function requestSync(): void {
  void runSync();
}

// Bound Inspector actions (production db + HTTP transport).
export async function runFullResync(): Promise<void> {
  const { getDb } = await import('./db/client');
  const { httpTransport } = await import('./transport');
  await fullResync(getDb(), httpTransport);
}
export async function runClearOutbox(): Promise<void> {
  const { getDb } = await import('./db/client');
  await clearOutbox(getDb());
}

export async function runSync(): Promise<void> {
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  const { getDb } = await import('./db/client');
  const { httpTransport } = await import('./transport');
  const db = getDb();
  try {
    do {
      rerun = false;
      await runSyncOnce(db, httpTransport);
    } while (rerun);
    await patchStatus(db, { phase: 'idle', lastError: null });
  } catch (err) {
    await patchStatus(db, { phase: 'error', lastError: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}
