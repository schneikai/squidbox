// Per-record monotonic logical clock (sync-design §6): never let two writes to the same record
// share a millisecond, and never go backwards, so the server's strict-`>` LWW can't silently
// drop a genuine edit. Pure + unit-tested (clock.test.ts).
export function nextUpdatedAt(prev: number | undefined, now: number = Date.now()): number {
  return prev != null && now <= prev ? prev + 1 : now;
}
