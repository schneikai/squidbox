import { eq, sql } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';

// sync_meta helpers: the pull cursor + a small status blob (surfaced by the Inspector).
const CURSOR_KEY = 'cursor';
const STATUS_KEY = 'status';
const FIRST_SYNC_KEY = 'firstSyncDone'; // '1' once the initial full pull has drained
const LAST_USER_KEY = 'lastSyncUserId'; // whose data currently lives in the local DB

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

async function setMeta(db: SyncDb, key: string, value: string): Promise<void> {
  await db
    .insert(schema.syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.syncMeta.key, set: { value } });
}

export async function getCursor(db: SyncDb): Promise<number> {
  return Number((await getMeta(db, CURSOR_KEY)) ?? 0);
}

// First-sync flag: the initial full pull (the big one after first login) has fully drained. Used to
// gate the app behind a "Setting up your library…" screen and to skip the whole-library derivation
// while that bulk load runs.
export async function markFirstSyncDone(db: SyncDb): Promise<void> {
  if (!(await isFirstSyncDone(db))) await setMeta(db, FIRST_SYNC_KEY, '1');
}
// Clear the flag so the "Setting up your library…" gate shows again for the next full pull. Used by
// fullResync (a full re-pull is, semantically, another first sync).
export async function clearFirstSyncDone(db: SyncDb): Promise<void> {
  await setMeta(db, FIRST_SYNC_KEY, '0');
}

// The user whose data currently lives in the local DB. Used to detect an account switch on login
// (a different user must start from a clean local slate — see resetSyncForUser in worker.ts).
export async function getLastSyncUser(db: SyncDb): Promise<string | null> {
  return getMeta(db, LAST_USER_KEY);
}
export async function setLastSyncUser(db: SyncDb, userId: string): Promise<void> {
  await setMeta(db, LAST_USER_KEY, userId);
}
export async function isFirstSyncDone(db: SyncDb): Promise<boolean> {
  return (await getMeta(db, FIRST_SYNC_KEY)) === '1';
}
export async function setCursor(db: SyncDb, cursor: number): Promise<void> {
  await setMeta(db, CURSOR_KEY, String(cursor));
}

// Writes only when the status changes, so an idle sync pass doesn't wake every status reader.
export async function patchStatus(db: SyncDb, patch: Partial<SyncStatus>): Promise<void> {
  const raw = await getMeta(db, STATUS_KEY);
  const next = JSON.stringify({ phase: 'idle', ...(raw ? JSON.parse(raw) : {}), ...patch });
  if (next !== raw) await setMeta(db, STATUS_KEY, next);
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
  await db.insert(schema.syncLog).values({
    ranAt: entry.ranAt,
    pushed: entry.pushed,
    pulled: entry.pulled,
    durationMs: entry.durationMs,
    error: entry.error ?? null,
    notes: entry.notes ?? null,
  });
  // Trim: keep only the newest SYNC_LOG_MAX by id.
  await db
    .delete(schema.syncLog)
    .where(
      sql`${schema.syncLog.id} <= (select id from ${schema.syncLog} order by id desc limit 1 offset ${SYNC_LOG_MAX})`,
    );
}
