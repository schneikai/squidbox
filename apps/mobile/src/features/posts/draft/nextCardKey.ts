import type { ChannelDraft } from './channelDraftReducer';

/** The key the next card added to `draft` takes (addCard). */
export default function nextCardKey(draft: Pick<ChannelDraft, 'key' | 'nextCard'>): string {
  return `${draft.key}-card-${draft.nextCard}`;
}
