import { eq } from 'drizzle-orm';
import type { AssetRecord, PushMutation, PushResult } from '@squidbox/shared';
import { getDb, schema } from './db/client';
import { pullChanges, pushMutations } from './api';
import { pendingRecordIds, clearOutboxRow } from './outbox';
import { getCursor, setCursor, patchStatus } from './status';
import { setSyncError } from './assetsRepository';

const PULL_LIMIT = 500;

// Single-flight: only one sync runs at a time; if asked while running, run once more after
// (a trailing re-run) so the latest outbox changes are drained.
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
  try {
    do {
      rerun = false;
      await pushPhase();
      await pullPhase();
    } while (rerun);
    await patchStatus({ phase: 'idle', lastError: null });
  } catch (err) {
    await patchStatus({ phase: 'error', lastError: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

async function pushPhase(): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(schema.outbox);
  if (rows.length === 0) return;
  await patchStatus({ phase: 'pushing' });

  const mutations: PushMutation[] = rows.map((r) => ({ collection: r.collection, record: r.payload }));
  const { results } = await pushMutations({ mutations });

  for (const result of results) {
    await handlePushResult(result);
  }
  await patchStatus({ lastPushAt: Date.now() });
}

async function handlePushResult(result: PushResult): Promise<void> {
  const db = getDb();
  if (result.status === 'applied') {
    await clearOutboxRow(db, result.collection, result.id);
    return;
  }
  if (result.status === 'skipped-lww') {
    // Adopt the server's winning record UNLESS a newer local edit is still pending for it.
    const stillPending = await pendingRecordIds(db, result.collection);
    if (result.current && result.collection === 'assets') {
      await applyAssetRecord(result.current as unknown as AssetRecord);
    }
    // The pending row we just pushed lost; drop it (a newer edit, if any, was re-coalesced
    // into the same row and will be re-pushed on the trailing run).
    if (!stillPending.has(result.id)) {
      await clearOutboxRow(db, result.collection, result.id);
    }
    return;
  }
  // rejected: keep the outbox row and surface the error locally (never silently drop).
  if (result.collection === 'assets') {
    await setSyncError(result.id, result.reason ?? 'rejected');
  }
}

async function pullPhase(): Promise<void> {
  await patchStatus({ phase: 'pulling' });
  let cursor = await getCursor();
  let hasMore = true;
  while (hasMore) {
    const page = await pullChanges({ cursor, limit: PULL_LIMIT });
    await applyPage(page.changes.assets?.records ?? []);
    cursor = page.cursor;
    await setCursor(cursor);
    hasMore = page.hasMore;
  }
  await patchStatus({ phase: 'idle', lastPullAt: Date.now(), cursor });
}

// Outbox-guarded apply (sync-design §5): apply an incoming record only if it has no pending
// local mutation. Never timestamp-compare against committed local state. One transaction/page.
async function applyPage(records: Array<Record<string, unknown>>): Promise<void> {
  if (records.length === 0) return;
  const db = getDb();
  const pending = await pendingRecordIds(db, 'assets');
  await db.transaction(async (tx) => {
    for (const record of records) {
      const id = String(record.id);
      if (pending.has(id)) continue; // local edit will re-assert via push
      await tx
        .insert(schema.assets)
        .values({ ...(record as AssetRecord), syncError: null })
        .onConflictDoUpdate({ target: schema.assets.id, set: record as AssetRecord });
    }
  });
}

async function applyAssetRecord(record: AssetRecord): Promise<void> {
  await getDb()
    .insert(schema.assets)
    .values({ ...record, syncError: null })
    .onConflictDoUpdate({ target: schema.assets.id, set: record });
}
