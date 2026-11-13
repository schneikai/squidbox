import type { PostDraft } from './postDraftReducer';

/** The channels the post's parts are on, but the one keyed `exceptKey` (none left out without it). */
export default function usedChannelIds(draft: Pick<PostDraft, 'main' | 'others'>, exceptKey?: string): Set<string> {
  return new Set(
    [draft.main, ...draft.others].flatMap((part) => (part.key !== exceptKey && part.channelId ? [part.channelId] : [])),
  );
}
