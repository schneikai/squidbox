import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { getDb, schema } from './db/client';
import type { SyncPhase } from './status';

// Reactive sync status for the dev status surface (seed of the Phase 3a Inspector): the phase +
// pending outbox count, live from SQLite.
export interface LiveSyncStatus {
  phase: SyncPhase;
  pendingCount: number;
  cursor: number;
  lastPushAt?: number;
  lastPullAt?: number;
  lastError?: string | null;
}

export function useSyncStatus(): LiveSyncStatus {
  const { data: meta } = useLiveQuery(getDb().select().from(schema.syncMeta));
  const { data: outbox } = useLiveQuery(getDb().select().from(schema.outbox));

  const byKey = Object.fromEntries((meta ?? []).map((r) => [r.key, r.value]));
  const status = byKey.status ? JSON.parse(byKey.status) : {};

  return {
    phase: status.phase ?? 'idle',
    pendingCount: (outbox ?? []).length,
    cursor: Number(byKey.cursor ?? 0),
    lastPushAt: status.lastPushAt,
    lastPullAt: status.lastPullAt,
    lastError: status.lastError ?? null,
  };
}

// True while the INITIAL full pull is running (after first login, before it has drained). Drives
// the "Setting up your library…" gate and lets the providers skip whole-library derivation until
// the bulk load is done. cursor>0 (a sync has started) + firstSyncDone unset (not finished).
export function useFirstSyncPending(): boolean {
  const { data: meta } = useLiveQuery(getDb().select().from(schema.syncMeta));
  const byKey = Object.fromEntries((meta ?? []).map((r) => [r.key, r.value]));
  return Number(byKey.cursor ?? 0) > 0 && byKey.firstSyncDone !== '1';
}
