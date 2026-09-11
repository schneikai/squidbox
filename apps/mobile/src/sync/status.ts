import { eq, lt, sql } from 'drizzle-orm';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';

// sync_meta helpers: the pull cursor + a small status blob (surfaced by the Inspector).
const CURSOR_KEY = 'cursor';
const STATUS_KEY = 'status';
const FIRST_SYNC_KEY = 'firstSyncDone'; // '1' once the initial full pull has drained

export type SyncPhase = 'idle' | 'pushing' | 'pulling' | 'error';
export interface SyncStatus {
  phase: SyncPhase;
  lastPushAt?: number;
  lastPullAt?: number;
  lastError?: string | null;
  cursor: number;
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
  await setMeta(db, FIRST_SYNC_KEY, '1');
}
export async function isFirstSyncDone(db: SyncDb): Promise<boolean> {
  return (await getMeta(db, FIRST_SYNC_KEY)) === '1';
}
export async function setCursor(db: SyncDb, cursor: number): Promise<void> {
  await setMeta(db, CURSOR_KEY, String(cursor));
}

export async function getStatus(db: SyncDb): Promise<SyncStatus> {
  const raw = await getMeta(db, STATUS_KEY);
  const blob = raw ? (JSON.parse(raw) as Partial<SyncStatus>) : {};
  // cursor is authoritative in CURSOR_KEY; never let the (possibly stale) status blob shadow it.
  return { phase: 'idle', ...blob, cursor: await getCursor(db) };
}
export async function patchStatus(db: SyncDb, patch: Partial<SyncStatus>): Promise<void> {
  const current = await getStatus(db);
  // Persist everything EXCEPT cursor (single-sourced in CURSOR_KEY) to avoid divergence.
  const { cursor: _cursor, ...persist } = { ...current, ...patch };
  await setMeta(db, STATUS_KEY, JSON.stringify(persist));
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
  const cutoff = await db
    .select({ id: schema.syncLog.id })
    .from(schema.syncLog)
    .orderBy(sql`${schema.syncLog.id} desc`)
    .limit(1)
    .offset(SYNC_LOG_MAX);
  if (cutoff[0]) {
    await db.delete(schema.syncLog).where(lt(schema.syncLog.id, cutoff[0].id + 1));
  }
}
