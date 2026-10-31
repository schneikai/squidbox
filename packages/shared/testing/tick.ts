import { vi } from 'vitest';

/**
 * Moves the faked `Date` on by one second: clearly later, even after the per-record bumps of
 * `nextUpdatedAt`. Only with `fakeClock()` on: without it, vitest would mock `Date` for good.
 */
export function tick(): void {
  if (!vi.isFakeTimers()) throw new Error('tick() needs fakeClock() first');
  vi.setSystemTime(Date.now() + 1000);
}
