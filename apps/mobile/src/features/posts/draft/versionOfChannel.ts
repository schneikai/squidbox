import type { ChannelDraft } from './channelDraftReducer';
import type { PostDraft } from './postDraftReducer';

/**
 * The version of the draft (the post's own or another) that goes to `channelId`, if any: a channel is
 * on one version at most.
 */
export default function versionOfChannel(
  draft: Pick<PostDraft, 'main' | 'others'>,
  channelId: string,
): ChannelDraft | undefined {
  return [draft.main, ...draft.others].find((version) => version.channelIds.includes(channelId));
}
