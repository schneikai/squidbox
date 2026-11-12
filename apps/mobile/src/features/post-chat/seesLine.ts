import type { AssetRow } from '@/sync/db/schema';

/**
 * What the assistant's grey lines say it sees in the photos (`rows`, the live assets with the chat's
 * tags; `isTagging`, taggingState's; `tags`, the post's tags the chat sends): the tags, or `noTags`
 * when there are none, once a photo is tagged or nothing is being tagged; null before (only "Looking
 * at the photos…" then) and when there are none and `noTags` is null.
 */
export default function seesLine(
  rows: readonly Pick<AssetRow, 'tags'>[],
  isTagging: boolean,
  tags: readonly string[],
  noTags: string | null = 'no tags',
): string | null {
  const isTagged = rows.some((row) => row.tags !== null);
  if (!isTagged && isTagging) return null;
  return tags.length > 0 ? tags.join(', ') : noTags;
}
