// Per-record monotonic logical clock (sync-design §6): never let two writes to the same record
// share a millisecond, and never go backwards, so the server's strict-`>` LWW can't silently
// drop a genuine edit. Pure + unit-tested (clock.test.ts).
export function nextUpdatedAt(prev: number | undefined, now: number = Date.now()): number {
  return prev != null && now <= prev ? prev + 1 : now;
}

/** `prev` with `changes`, as its next version. */
export function nextVersion<T extends { updatedAt: number }>(prev: T, changes: Partial<T> = {}): T {
  return { ...prev, ...changes, updatedAt: nextUpdatedAt(prev.updatedAt) };
}

/** `prev` as a tombstone (sync-design §2). */
export function tombstone<T extends { updatedAt: number; deletedAt: number | null }>(prev: T): T {
  const ts = nextUpdatedAt(prev.updatedAt);
  return { ...prev, updatedAt: ts, deletedAt: ts };
}
