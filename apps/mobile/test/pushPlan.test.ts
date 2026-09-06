import { describe, it, expect } from 'vitest';
import { planPushOutcome, chunk } from '../src/sync/pushPlan';

describe('planPushOutcome', () => {
  it('applied + not superseded → clear outbox and clear error', () => {
    expect(planPushOutcome({ status: 'applied', pushedUpdatedAt: 100, currentOutboxUpdatedAt: 100 })).toEqual({
      clearOutbox: true,
      adoptCurrent: false,
      flagRejected: false,
      clearError: true,
    });
  });

  it('applied + superseded (newer local edit) → keep everything (next push arbitrates)', () => {
    expect(planPushOutcome({ status: 'applied', pushedUpdatedAt: 100, currentOutboxUpdatedAt: 200 })).toEqual({
      clearOutbox: false,
      adoptCurrent: false,
      flagRejected: false,
      clearError: false,
    });
  });

  it('skipped-lww + not superseded → adopt current and clear outbox', () => {
    expect(planPushOutcome({ status: 'skipped-lww', pushedUpdatedAt: 100, currentOutboxUpdatedAt: 100 })).toEqual({
      clearOutbox: true,
      adoptCurrent: true,
      flagRejected: false,
      clearError: true,
    });
  });

  it('skipped-lww + superseded → keep, do NOT adopt (local is newer)', () => {
    expect(planPushOutcome({ status: 'skipped-lww', pushedUpdatedAt: 100, currentOutboxUpdatedAt: 200 })).toMatchObject({
      clearOutbox: false,
      adoptCurrent: false,
    });
  });

  it('rejected → keep outbox and flag, regardless of supersession', () => {
    expect(planPushOutcome({ status: 'rejected', pushedUpdatedAt: 100, currentOutboxUpdatedAt: 100 })).toEqual({
      clearOutbox: false,
      adoptCurrent: false,
      flagRejected: true,
      clearError: false,
    });
  });

  it('treats a cleared outbox row (null) as not superseded', () => {
    expect(planPushOutcome({ status: 'applied', pushedUpdatedAt: 100, currentOutboxUpdatedAt: null }).clearOutbox).toBe(true);
  });
});

describe('chunk', () => {
  it('splits into batches of at most size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('returns [] for empty input', () => {
    expect(chunk([], 500)).toEqual([]);
  });
  it('throws on non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
