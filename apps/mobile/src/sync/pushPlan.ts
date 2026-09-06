import type { PushResultStatus } from '@squidbox/shared';

// Pure decision logic for what to do with an outbox row after a push result comes back.
// Extracted from the worker so the trickiest convergence logic is unit-tested (pushPlan.test.ts)
// without needing SQLite/a device.
//
// Key correctness point (code-review finding): we must NOT clear/adopt when the local record
// was edited again DURING the push (the outbox row was coalesced to a newer updatedAt). We
// compare the outbox row's current updatedAt to the updatedAt we actually pushed:
//   - superseded (a newer local edit exists): keep the row, don't adopt — the next push arbitrates.
//   - applied, not superseded: clear the row (synced).
//   - skipped-lww, not superseded: adopt the server's `current` and clear the row.
//   - rejected: keep the row and flag the error (never silently drop).
export interface PushOutcomePlan {
  clearOutbox: boolean;
  adoptCurrent: boolean;
  flagRejected: boolean;
  /** clear a previously-set local syncError because this record is now settled */
  clearError: boolean;
}

export function planPushOutcome(params: {
  status: PushResultStatus;
  pushedUpdatedAt: number;
  /** current outbox row's updatedAt, or null if the row is already gone */
  currentOutboxUpdatedAt: number | null;
}): PushOutcomePlan {
  const { status, pushedUpdatedAt, currentOutboxUpdatedAt } = params;

  if (status === 'rejected') {
    return { clearOutbox: false, adoptCurrent: false, flagRejected: true, clearError: false };
  }

  const superseded = currentOutboxUpdatedAt != null && currentOutboxUpdatedAt > pushedUpdatedAt;
  if (superseded) {
    return { clearOutbox: false, adoptCurrent: false, flagRejected: false, clearError: false };
  }

  if (status === 'applied') {
    return { clearOutbox: true, adoptCurrent: false, flagRejected: false, clearError: true };
  }
  // skipped-lww, not superseded
  return { clearOutbox: true, adoptCurrent: true, flagRejected: false, clearError: true };
}

/** Split an array into chunks of at most `size` (push batching — server caps at 500/req). */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
