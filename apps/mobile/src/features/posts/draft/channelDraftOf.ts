import type { ChannelDraft } from './channelDraftReducer';
import nextCardKey from './nextCardKey';

import type { PostCardContent } from '@/features/posts/PostCard';

/** A channel's draft from its posts' contents (the first post, then its thread), keyed from `key`. */
export default function channelDraftOf<C extends string | null>(
  key: string,
  id: string | null,
  channelId: C,
  contents: PostCardContent[],
): ChannelDraft & { channelId: C } {
  const cards = contents.map((content, i) => ({ ...content, key: nextCardKey({ key, nextCard: i }) }));
  return { key, id, channelId, cards, nextCard: cards.length };
}
