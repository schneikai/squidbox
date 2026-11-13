import channelDraftOf from './channelDraftOf';
import channelKey from './channelKey';
import firstUnusedChannelId from './firstUnusedChannelId';
import type { OtherChannelDraft, PostDraft } from './postDraftReducer';

import buildPostAssets from '@/utils/posts/buildPostAssets';

/**
 * A new other channel: on the first of the user's channels the post doesn't use yet, holding the post's
 * first card's text and its media as fresh refs (not its thread); null when every one is used.
 */
export default function newChannelDraft(draft: PostDraft, userChannelIds: string[]): OtherChannelDraft | null {
  const channelId = firstUnusedChannelId(draft, userChannelIds);
  if (!channelId) return null;
  const first = draft.main.cards[0]!;
  const postAssets = buildPostAssets(first.postAssets.map((postAsset) => postAsset.asset));
  return {
    ...channelDraftOf(channelKey(draft.nextChannel), null, channelId, [{ id: null, text: first.text, postAssets }]),
    channelId,
  };
}
