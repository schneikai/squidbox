import type { AssetRow } from '@/sync/db/schema';

/**
 * What the assistant's grey lines say about the photos (`rows`, the live assets with the chat's
 * tags; `isTagging`, taggingState's; `tags`, the post's tags the chat sends): `tagsText`, the tags
 * or "no tags", once a photo is tagged or nothing is being tagged, else null; and `isLooking`, while
 * a photo is being tagged ("Looking at the photos…").
 */
export default function seesLine(
  rows: readonly Pick<AssetRow, 'tags'>[],
  isTagging: boolean,
  tags: readonly string[],
): { tagsText: string | null; isLooking: boolean } {
  const isTagged = rows.some((row) => row.tags !== null);
  const tagsText = isTagged || !isTagging ? (tags.length > 0 ? tags.join(', ') : 'no tags') : null;
  return { tagsText, isLooking: isTagging };
}
