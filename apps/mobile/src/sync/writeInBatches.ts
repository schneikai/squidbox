import { chunk } from '@squidbox/shared';

import { APPLY_BATCH } from './worker';

export interface BatchOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Runs `write` per 5,000 ids (one transaction of ten 500-row statements each, like a pull), so a
 * bulk action commits a few times instead of once per statement and every commit's live re-read
 * stays rare. Reports `done` of `total` after each batch and stops between batches once cancelled,
 * keeping what is already committed. Resolves to whether every batch was written.
 */
export async function writeInBatches(
  ids: string[],
  write: (batch: string[]) => Promise<void>,
  { onProgress, signal }: BatchOptions = {},
): Promise<boolean> {
  let done = 0;
  for (const batch of chunk(ids, APPLY_BATCH)) {
    if (signal?.aborted) return false;
    await write(batch);
    done += batch.length;
    onProgress?.(done, ids.length);
  }
  return true;
}
