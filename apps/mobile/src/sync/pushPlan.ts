import type { PushResultStatus } from '@squidbox/shared';

// Pure decision logic for what to do with an outbox row after a push result comes back.
// Extracted from the worker so the trickiest convergence logic is unit-tested (pushPlan.test.ts)
// without needing SQLite/a device.
//
// Key correctness point (code-review finding): we must NOT clear/adopt/flag when the local record
// was edited again DURING the push (the outbox row was coalesced to a newer updatedAt). We
// compare the outbox row's current updatedAt to the updatedAt we actually pushed:
//   - superseded (a newer local edit exists): keep the row as is — the next push arbitrates.
//   - applied, not superseded: clear the row (synced).
//   - skipped-lww, not superseded: adopt the server's `current` and clear the row.
//   - rejected, not superseded: keep the row and flag it with the reason; it waits (§6).
export interface PushOutcomePlan {
  clearOutbox: boolean;
  adoptCurrent: boolean;
  flagRejected: boolean;
}

export function planPushOutcome(params: {
  status: PushResultStatus;
  pushedUpdatedAt: number;
  /** current outbox row's updatedAt, or null if the row is already gone */
  currentOutboxUpdatedAt: number | null;
}): PushOutcomePlan {
  const { status, pushedUpdatedAt, currentOutboxUpdatedAt } = params;

  const superseded = currentOutboxUpdatedAt != null && currentOutboxUpdatedAt > pushedUpdatedAt;
  if (superseded) {
    return { clearOutbox: false, adoptCurrent: false, flagRejected: false };
  }

  if (status === 'rejected') {
    return { clearOutbox: false, adoptCurrent: false, flagRejected: true };
  }
  if (status === 'applied') {
    return { clearOutbox: true, adoptCurrent: false, flagRejected: false };
  }
  // skipped-lww, not superseded
  return { clearOutbox: true, adoptCurrent: true, flagRejected: false };
}
