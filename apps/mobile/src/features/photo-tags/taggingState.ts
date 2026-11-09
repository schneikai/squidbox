import type { TagAttempts } from './createTagAttempts';

import type { AssetRow } from '@/sync/db/schema';

/**
 * Which of `rows` count as tagging and which wait for a tap (`untagged`), from their taggings
 * (`attempts`, by asset id), whether the assistant is available, and `hasRun` (tried in this app
 * run). A photo never tagged and not tried in this app run is tagged right after this render while
 * the assistant is available (so it counts as tagging already), else it waits for Tag. A photo tried
 * before has an attempt, or its tags are on their way to the row.
 */
export default function taggingState<Row extends Pick<AssetRow, 'id' | 'tags'>>(
  rows: readonly Row[] | undefined,
  attempts: TagAttempts,
  isAvailable: boolean,
  hasRun: (id: string) => boolean,
): { isTagging: boolean; untagged: Row[] } {
  const notTried = (rows ?? []).filter((row) => row.tags === null && !attempts[row.id] && !hasRun(row.id));
  const isTagging =
    Object.values(attempts).some((attempt) => attempt?.status === 'loading') || (isAvailable && notTried.length > 0);
  const untagged = isAvailable ? [] : notTried;
  return { isTagging, untagged };
}
