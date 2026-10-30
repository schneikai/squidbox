import { onTestFinished, vi } from 'vitest';

/**
 * Fakes `Date` for the current test (timers stay real) and gives `tick()`, which moves it on by one
 * second: clearly later, even after the per-record bumps of `nextUpdatedAt`.
 */
export function fakeClock() {
  vi.useFakeTimers({ toFake: ['Date'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  return { tick: () => vi.setSystemTime(Date.now() + 1000) };
}
