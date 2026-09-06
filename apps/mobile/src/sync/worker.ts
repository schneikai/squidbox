import type { AssetRecord, PushMutation, PushResult } from '@squidbox/shared';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import type { SyncTransport } from './transport';
import { pendingRecordIds, clearOutboxRow, getOutboxUpdatedAt } from './outbox';
import { getCursor, setCursor, patchStatus } from './status';
import { setSyncError } from './assetsRepository';
import { planPushOutcome, chunk } from './pushPlan';

const PULL_LIMIT = 500;
const PUSH_BATCH = 500; // server caps pushRequest mutations at 500

// ── DI core: one push→pull pass against an injected db + transport. Testable off-device
// (better-sqlite3 + an in-process transport). No single-flight/looping here — that's the
// production wrapper below.
export async function runSyncOnce(db: SyncDb, transport: SyncTransport): Promise<void> {
  await pushPhase(db, transport);
  await pullPhase(db, transport);
}

async function pushPhase(db: SyncDb, transport: SyncTransport): Promise<void> {
  const rows = await db.select().from(schema.outbox);
  if (rows.length === 0) return;
  await patchStatus(db, { phase: 'pushing' });

  // updatedAt we actually pushed, per record — used to detect edits made DURING the push.
  const pushedUpdatedAt = new Map<string, number>();
  for (const r of rows) pushedUpdatedAt.set(`${r.collection}:${r.recordId}`, r.updatedAt);

  for (const batch of chunk(rows, PUSH_BATCH)) {
    const mutations: PushMutation[] = batch.map((r) => ({ collection: r.collection, record: r.payload }));
    const { results } = await transport.push({ mutations });
    for (const result of results) {
      await applyPushResult(db, result, pushedUpdatedAt.get(`${result.collection}:${result.id}`) ?? 0);
    }
  }
  await patchStatus(db, { lastPushAt: Date.now() });
}

async function applyPushResult(db: SyncDb, result: PushResult, pushedUpdatedAt: number): Promise<void> {
  const currentOutboxUpdatedAt = await getOutboxUpdatedAt(db, result.collection, result.id);
  const plan = planPushOutcome({ status: result.status, pushedUpdatedAt, currentOutboxUpdatedAt });

  if (plan.adoptCurrent && result.current && result.collection === 'assets') {
    await applyAssetRecord(db, result.current as unknown as AssetRecord);
  }
  if (plan.clearOutbox) await clearOutboxRow(db, result.collection, result.id);
  if (plan.clearError && result.collection === 'assets') await setSyncError(db, result.id, null);
  if (plan.flagRejected && result.collection === 'assets') await setSyncError(db, result.id, result.reason ?? 'rejected');
}

async function pullPhase(db: SyncDb, transport: SyncTransport): Promise<void> {
  await patchStatus(db, { phase: 'pulling' });
  let cursor = await getCursor(db);
  let hasMore = true;
  while (hasMore) {
    const page = await transport.pull({ cursor, limit: PULL_LIMIT });
    await applyPage(db, page.changes.assets?.records ?? []);
    cursor = page.cursor;
    await setCursor(db, cursor);
    hasMore = page.hasMore;
  }
  await patchStatus(db, { phase: 'idle', lastPullAt: Date.now() });
}

// Outbox-guarded apply (sync-design §5): apply an incoming record only if it has no pending
// local mutation. Never timestamp-compare against committed local state. One transaction/page.
async function applyPage(db: SyncDb, records: Array<Record<string, unknown>>): Promise<void> {
  if (records.length === 0) return;
  const pending = await pendingRecordIds(db, 'assets');
  // Synchronous transaction (drizzle SQLite) — no async callback (see assetsRepository note).
  db.transaction((tx) => {
    for (const record of records) {
      if (pending.has(String(record.id))) continue; // local edit will re-assert via push
      (tx as unknown as SyncDb)
        .insert(schema.assets)
        .values({ ...(record as AssetRecord), syncError: null })
        .onConflictDoUpdate({ target: schema.assets.id, set: record as AssetRecord })
        .run();
    }
  });
}

async function applyAssetRecord(db: SyncDb, record: AssetRecord): Promise<void> {
  await db
    .insert(schema.assets)
    .values({ ...record, syncError: null })
    .onConflictDoUpdate({ target: schema.assets.id, set: record })
    .run();
}

// ── Production wrapper: single-flight + trailing re-run, bound to the real device DB + HTTP
// transport. Call requestSync() after a local write (from the provider) or on foreground/interval.
let running = false;
let rerun = false;

export function requestSync(): void {
  void runSync();
}

export async function runSync(): Promise<void> {
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  // Imported lazily so the DI core stays free of the native expo-sqlite singleton.
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
