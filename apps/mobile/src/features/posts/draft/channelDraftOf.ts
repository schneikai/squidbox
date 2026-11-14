import type { ChannelDraft } from './channelDraftReducer';
import nextCardKey from './nextCardKey';

import type { PostCardContent } from '@/features/posts/PostCard';

/** A version's draft from its posts' contents (the first post, then its thread), keyed from `key`. */
export default function channelDraftOf(
  key: string,
  id: string | null,
  channelIds: string[],
  contents: PostCardContent[],
): ChannelDraft {
  const cards = contents.map((content, i) => ({ ...content, key: nextCardKey({ key, nextCard: i }) }));
  return { key, id, channelIds, cards, nextCard: cards.length };
}
