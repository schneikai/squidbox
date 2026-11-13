import type { ChannelDraft } from './channelDraftReducer';
import type { PostDraft } from './postDraftReducer';

/** The draft's channel keyed `key` (the post's own or another); throws when the draft doesn't hold it. */
export default function draftChannel(draft: Pick<PostDraft, 'main' | 'others'>, key: string): ChannelDraft {
  const channel = [draft.main, ...draft.others].find((part) => part.key === key);
  if (!channel) throw new Error(`The post draft has no channel ${key}`);
  return channel;
}
