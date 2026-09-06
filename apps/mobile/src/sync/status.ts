import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';

// sync_meta helpers: the pull cursor + a small status blob (surfaced by the Inspector in 3a).
const CURSOR_KEY = 'cursor';
const STATUS_KEY = 'status';

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
