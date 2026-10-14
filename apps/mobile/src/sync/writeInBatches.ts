import { chunk } from './chunk';
import { APPLY_BATCH } from './worker';

export interface BatchOptions {
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => boolean;
}

/**
 * Runs `write` per 5,000 ids (one transaction of ten 500-row statements each, like a pull), so a
 * bulk action commits a few times instead of once per statement and every commit's live re-read
 * stays rare. Reports `done` of `total` after each batch and stops between batches once cancelled,
 * keeping what is already committed.
 */
export async function writeInBatches(
  ids: string[],
  write: (batch: string[]) => Promise<void>,
  { onProgress, isCancelled }: BatchOptions = {},
): Promise<void> {
  let done = 0;
  for (const batch of chunk(ids, APPLY_BATCH)) {
    if (isCancelled?.()) return;
    await write(batch);
    done += batch.length;
    onProgress?.(done, ids.length);
  }
}
