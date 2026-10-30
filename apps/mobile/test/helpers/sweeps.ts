import { flushTurns } from './flushTurns';
import type { sweepPurgedFiles } from '../../src/sync/sweepPurgedFiles';

type Sweep = typeof sweepPurgedFiles;

const pending = new Set<Promise<void>>();

/** Wraps the real sweep so that `sweepsSettled` can wait for every call of it (for a `vi.mock` factory). */
export function trackSweeps(sweep: Sweep): Sweep {
  return (...args) => {
    const run = sweep(...args);
    pending.add(run);
    return run;
  };
}

/**
 * Resolves once no tracked sweep is running, the ones a library's open or `sweepOpenLibrary` started
 * included: those are called a few promise turns after the request, so it flushes before each look.
 */
export async function sweepsSettled(): Promise<void> {
  for (;;) {
    await flushTurns();
    if (pending.size === 0) return;
    const runs = [...pending];
    await Promise.allSettled(runs);
    for (const run of runs) pending.delete(run);
  }
}

/** Forgets the tracked sweeps, so that one a failed test left held holds up no later test. */
export function forgetSweeps(): void {
  pending.clear();
}
