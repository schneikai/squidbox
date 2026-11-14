import nextCardKey from './nextCardKey';

import type { PostCardChange, PostCardData } from '@/features/posts/PostCard';
import toggleItem from '@/utils/toggleItem';

/**
 * One version of a post as the editor drafts it: the post itself (`key` MAIN_KEY as it opens) or
 * another version. `id` is the saved post's (null for a new one, and for the post itself, which its
 * sheet saves), `channelIds` the channels it goes to in the order they were added (none: a post
 * without a channel), `cards` its first post and its thread, `nextCard` the number the next card's
 * key takes. Card keys start with the version's key, so they are unique across the sheet.
 */
export type ChannelDraft = {
  key: string;
  id: string | null;
  channelIds: string[];
  cards: PostCardData[];
  nextCard: number;
};

export type ChannelDraftAction =
  | { type: 'updateCard'; key: string; changes: PostCardChange }
  | { type: 'addCard' }
  | { type: 'removeCard'; key: string }
  | { type: 'toggleChannel'; channelId: string };

/**
 * Edits one version (postDraftReducer runs it on the version keyed): its cards, and `toggleChannel`
 * appends a channel to its channels or takes it off. Taking off its last channel throws (the version
 * is removed instead).
 */
export default function channelDraftReducer<D extends ChannelDraft>(draft: D, action: ChannelDraftAction): D {
  switch (action.type) {
    case 'updateCard':
      return {
        ...draft,
        cards: draft.cards.map((card) => (card.key === action.key ? { ...card, ...action.changes } : card)),
      };
    case 'addCard':
      return {
        ...draft,
        cards: [...draft.cards, { key: nextCardKey(draft), id: null, text: '', postAssets: [] }],
        nextCard: draft.nextCard + 1,
      };
    case 'removeCard':
      // The first card is the post itself: only a following one goes.
      return { ...draft, cards: draft.cards.filter((card, i) => i === 0 || card.key !== action.key) };
    case 'toggleChannel': {
      const channelIds = toggleItem(draft.channelIds, action.channelId);
      if (channelIds.length === 0) throw new Error("A version's last channel can't be taken off");
      return { ...draft, channelIds };
    }
  }
}
