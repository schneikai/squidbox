import type { ChannelDraft } from './channelDraftReducer';
import nextCardKey from './nextCardKey';

import type { PostCardContent } from '@/features/posts/PostCard';

/** A channel's draft from its posts' contents (the first post, then its thread), keyed from `key`. */
export default function channelDraftOf(
  key: string,
  id: string | null,
  channelId: string | null,
  contents: PostCardContent[],
): ChannelDraft {
  const cards = contents.map((content, i) => ({ ...content, key: nextCardKey({ key, nextCard: i }) }));
  return { key, id, channelId, cards, nextCard: cards.length };
}
