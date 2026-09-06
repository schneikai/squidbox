import { eq } from 'drizzle-orm';
import { getDb, schema } from './db/client';

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

async function getMeta(key: string): Promise<string | null> {
  const [row] = await getDb().select().from(schema.syncMeta).where(eq(schema.syncMeta.key, key));
  return row?.value ?? null;
}

async function setMeta(key: string, value: string): Promise<void> {
  await getDb()
    .insert(schema.syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.syncMeta.key, set: { value } });
}

export async function getCursor(): Promise<number> {
  return Number((await getMeta(CURSOR_KEY)) ?? 0);
}
export async function setCursor(cursor: number): Promise<void> {
  await setMeta(CURSOR_KEY, String(cursor));
}

export async function getStatus(): Promise<SyncStatus> {
  const raw = await getMeta(STATUS_KEY);
  const base: SyncStatus = { phase: 'idle', cursor: await getCursor() };
  return raw ? { ...base, ...(JSON.parse(raw) as Partial<SyncStatus>) } : base;
}
export async function patchStatus(patch: Partial<SyncStatus>): Promise<void> {
  const current = await getStatus();
  await setMeta(STATUS_KEY, JSON.stringify({ ...current, ...patch }));
}
