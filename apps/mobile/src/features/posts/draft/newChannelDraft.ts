import channelDraftOf from './channelDraftOf';
import type { ChannelDraft } from './channelDraftReducer';
import channelKey from './channelKey';

import freshPostAssets from '@/utils/posts/freshPostAssets';

/**
 * A new version of the post for `channelId`, keyed by the draft's `nextChannel`, holding a copy of
 * `cards` (all the cards of the version that shows, its thread too). Each card keeps its text and gets
 * its media as fresh refs, with no saved id.
 */
export default function newChannelDraft(
  nextChannel: number,
  channelId: string,
  cards: ChannelDraft['cards'],
): ChannelDraft {
  const contents = cards.map((card) => ({ id: null, text: card.text, postAssets: freshPostAssets(card.postAssets) }));
  return channelDraftOf(channelKey(nextChannel), null, [channelId], contents);
}
