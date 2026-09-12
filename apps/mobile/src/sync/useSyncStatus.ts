import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { getDb, schema } from './db/client';
import type { SyncPhase } from './status';

// Reactive sync status for the dev status surface + Inspector: the phase +
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

// PERF pause signal for the providers: skip the heavy full-table reads + whole-library derivation
// while the initial bulk pull is streaming pages in (cursor>0 = a page has landed, firstSyncDone
// unset = not finished). This is a pure optimization — the UI is gated behind FirstSyncScreen — so
// being slightly early/late is harmless. NOTE: the *gate* itself must NOT use this (it would leave
// a hole before the first page / on an auth error); the gate is auth-aware (see App.js).
export function useFirstSyncPending(): boolean {
  const { data: meta } = useLiveQuery(getDb().select().from(schema.syncMeta));
  const byKey = Object.fromEntries((meta ?? []).map((r) => [r.key, r.value]));
  return Number(byKey.cursor ?? 0) > 0 && byKey.firstSyncDone !== '1';
}

// True once the initial full pull has fully drained (firstSyncDone === '1'), live. Combined with
// "is the user authenticated" in App.js, this drives the "Setting up your library…" gate: it shows
// from the moment we're logged in until the whole library has landed — including the very first
// page and any ret/auth errors along the way (so there's never a silent empty screen).
export function useFirstSyncDone(): boolean {
  const { data: meta } = useLiveQuery(getDb().select().from(schema.syncMeta));
  const byKey = Object.fromEntries((meta ?? []).map((r) => [r.key, r.value]));
  return byKey.firstSyncDone === '1';
}
