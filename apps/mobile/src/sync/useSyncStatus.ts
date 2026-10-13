import { count } from 'drizzle-orm';

import { getDb } from './db/client';
import * as schema from './db/schema';
import { getCursor, getStatus, isFirstSyncDone, type SyncPhase } from './status';
import { useLiveQuery } from './useLiveQuery';

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
  const db = getDb();
  const meta = useLiveQuery(async () => ({ ...(await getStatus(db)), cursor: await getCursor(db) }), [schema.syncMeta]);
  const [pending] = useLiveQuery(() => db.select({ count: count() }).from(schema.outbox), [schema.outbox]) ?? [];

  return {
    phase: meta?.phase ?? 'idle',
    pendingCount: pending?.count ?? 0,
    cursor: meta?.cursor ?? 0,
    lastPushAt: meta?.lastPushAt,
    lastPullAt: meta?.lastPullAt,
    lastError: meta?.lastError ?? null,
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
// A boolean, so the many other sync_meta writes (status, cursor) don't re-render its callers.
export function useFirstSyncDone(): boolean | undefined {
  return useLiveQuery(() => isFirstSyncDone(getDb()), [schema.syncMeta]);
}
