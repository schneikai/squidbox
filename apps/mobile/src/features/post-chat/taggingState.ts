import type { TagAttempts } from '@/lib/createTagAttempts';
import type { AssetRow } from '@/sync/db/schema';

type TaggingContext = {
  // Whether the assistant is available: a photo never tagged is tagged when a turn goes.
  isAvailable: boolean;
  // Whether a photo never tagged is tagged right after this render (the chat screen tags its photos
  // as it opens), so it counts as tagging already.
  willTag: boolean;
  // Whether a photo was tried in this app run.
  hasRun: (id: string) => boolean;
};

/**
 * Which of `rows` count as tagging and which wait for a tap (`untagged`), from their taggings
 * (`attempts`, by asset id) and `context`. A photo never tagged and not tried in this app run counts
 * as tagging only where it `willTag` by itself; it waits for Tag only while the assistant is
 * unavailable (else a turn tags it). A photo tried before has an attempt, or its tags are on their
 * way to the row.
 */
export default function taggingState<Row extends Pick<AssetRow, 'id' | 'tags'>>(
  rows: readonly Row[] | undefined,
  attempts: TagAttempts,
  { isAvailable, willTag, hasRun }: TaggingContext,
): { isTagging: boolean; untagged: Row[] } {
  const notTried = (rows ?? []).filter((row) => row.tags === null && !attempts[row.id] && !hasRun(row.id));
  const isTagging =
    Object.values(attempts).some((attempt) => attempt?.status === 'loading') ||
    (isAvailable && willTag && notTried.length > 0);
  const untagged = isAvailable ? [] : notTried;
  return { isTagging, untagged };
}
