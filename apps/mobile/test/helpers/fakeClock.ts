import { onTestFinished, vi } from 'vitest';

/** Fakes `Date` for the current test; timers stay real. `tick` moves it on. */
export function fakeClock(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/** Moves the faked `Date` on by one second: clearly later, even after the per-record bumps of `nextUpdatedAt`. */
export function tick(): void {
  vi.setSystemTime(Date.now() + 1000);
}
