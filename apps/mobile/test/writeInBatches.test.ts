import { describe, it, expect } from 'vitest';

import { writeInBatches } from '../src/sync/writeInBatches';

const ids = Array.from({ length: 12_000 }, (_, i) => `id-${i}`);

describe('writeInBatches', () => {
  it('writes 5,000 ids per batch and reports progress after each', async () => {
    const batches: number[] = [];
    const progress: [number, number][] = [];
    const finished = await writeInBatches(
      ids,
      async (batch) => {
        batches.push(batch.length);
      },
      { onProgress: (done, total) => progress.push([done, total]) },
    );
    expect(finished).toBe(true);
    expect(batches).toEqual([5000, 5000, 2000]);
    expect(progress).toEqual([
      [5000, 12_000],
      [10_000, 12_000],
      [12_000, 12_000],
    ]);
  });

  it('stops between batches once cancelled, keeping what is written, and says it did not finish', async () => {
    let cancelled = false;
    const batches: number[] = [];
    const finished = await writeInBatches(
      ids,
      async (batch) => {
        batches.push(batch.length);
      },
      { onProgress: () => (cancelled = true), isCancelled: () => cancelled },
    );
    expect(batches).toEqual([5000]);
    expect(finished).toBe(false); // so the caller can say it stopped
  });
});
