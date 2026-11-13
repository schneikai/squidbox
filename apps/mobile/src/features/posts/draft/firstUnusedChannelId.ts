import type { PostDraft } from './postDraftReducer';
import usedChannelIds from './usedChannelIds';

/** The first of the user's channels (`userChannelIds`, in order) the post doesn't use yet; none when all are used. */
export default function firstUnusedChannelId(
  draft: Pick<PostDraft, 'main' | 'others'>,
  userChannelIds: string[],
): string | undefined {
  const used = usedChannelIds(draft);
  return userChannelIds.find((id) => !used.has(id));
}
