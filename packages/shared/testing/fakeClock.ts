import { onTestFinished, vi } from 'vitest';

/** Fakes `Date` for the current test (timers stay real), until it finishes. `tick` moves it on. */
export function fakeClock(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
