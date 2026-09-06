import { describe, it, expect } from 'vitest';
import { nextUpdatedAt } from '../src/sync/clock';

describe('nextUpdatedAt (per-record monotonic clock)', () => {
  it('uses now when now > prev', () => {
    expect(nextUpdatedAt(100, 200)).toBe(200);
  });
  it('bumps to prev+1 when now == prev (same-millisecond edits)', () => {
    expect(nextUpdatedAt(200, 200)).toBe(201);
  });
  it('bumps to prev+1 when the clock is behind (now < prev)', () => {
    expect(nextUpdatedAt(200, 150)).toBe(201);
  });
  it('uses now when there is no previous value', () => {
    expect(nextUpdatedAt(undefined, 500)).toBe(500);
  });
});
