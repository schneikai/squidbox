import { count } from 'drizzle-orm';

import { getDb } from './db/client';
import * as schema from './db/schema';
import type { SyncPhase } from './status';
import { useLiveQuery } from './useLiveQuery';

// sync_meta as a { key: value } lookup, live; undefined until read once.
function useSyncMeta(): Record<string, string | null> | undefined {
  const meta = useLiveQuery(() => getDb().select().from(schema.syncMeta), [schema.syncMeta]);
  return meta && Object.fromEntries(meta.map((row) => [row.key, row.value]));
}

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
  const byKey = useSyncMeta() ?? {};
  const [pending] = useLiveQuery(() => getDb().select({ count: count() }).from(schema.outbox), [schema.outbox]) ?? [];

  const status = byKey.status ? JSON.parse(byKey.status) : {};

  return {
    phase: status.phase ?? 'idle',
    pendingCount: pending?.count ?? 0,
    cursor: Number(byKey.cursor ?? 0),
    lastPushAt: status.lastPushAt,
    lastPullAt: status.lastPullAt,
    lastError: status.lastError ?? null,
  };
}

// True once the initial full pull has fully drained (firstSyncDone === '1'), live. Combined with
// "is the user authenticated" in App.js (see AppGate), this drives the "Setting up your library…"
// gate: it shows from the moment we're logged in until the whole library has landed — including the
// very first page and any transient/auth errors along the way (so there's never a silent empty
// screen), and pre-login it stays off.
// Returns `undefined` until sync_meta has been read once. Callers MUST treat undefined as "unknown"
// and not gate on it, otherwise the setup screen flashes for a frame on every launch for an
// already-synced user.
export function useFirstSyncDone(): boolean | undefined {
  const meta = useSyncMeta();
  return meta && meta.firstSyncDone === '1';
}
