import nextCardKey from './nextCardKey';

import type { PostCardChange, PostCardData } from '@/features/posts/PostCard';

/**
 * One channel of a post as the editor drafts it: the post itself (`key` MAIN_KEY as it opens) or
 * another channel. `id` is the saved post's (null for a new one, and for the post itself, which its
 * sheet saves), `cards` its first post and its thread, `nextCard` the number the next card's key
 * takes. Card keys start with the channel's key, so they are unique across the sheet.
 */
export type ChannelDraft = {
  key: string;
  id: string | null;
  channelId: string | null;
  cards: PostCardData[];
  nextCard: number;
};

export type ChannelDraftAction =
  | { type: 'updateCard'; key: string; changes: PostCardChange }
  | { type: 'addCard' }
  | { type: 'removeCard'; key: string }
  | { type: 'setChannel'; channelId: string };

/** Edits one channel's cards (postDraftReducer runs it on the channel keyed). */
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
    case 'setChannel':
      return { ...draft, channelId: action.channelId };
  }
}
