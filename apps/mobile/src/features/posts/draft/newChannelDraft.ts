import channelDraftOf from './channelDraftOf';
import channelKey from './channelKey';
import draftChannel from './draftChannel';
import type { OtherChannelDraft, PostDraft } from './postDraftReducer';

import freshPostAssets from '@/utils/posts/freshPostAssets';

/**
 * A new other channel of the post on `channelId`, holding the selected channel's first card: its text,
 * and its media as fresh refs (not its thread).
 */
export default function newChannelDraft(draft: PostDraft, channelId: string): OtherChannelDraft {
  const first = draftChannel(draft, draft.selectedKey).cards[0]!;
  const postAssets = freshPostAssets(first.postAssets);
  return channelDraftOf(channelKey(draft.nextChannel), null, channelId, [{ id: null, text: first.text, postAssets }]);
}
