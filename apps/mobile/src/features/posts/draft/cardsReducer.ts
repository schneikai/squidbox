import nextCardKey from './nextCardKey';

import type { PostCardChange, PostCardData } from '@/features/posts/PostCard';

/**
 * A post's cards as an editor drafts them: its first post, then its thread (`cards`), and the number
 * the next card's key takes (`nextCard`).
 */
export type CardsDraft = {
  cards: PostCardData[];
  nextCard: number;
};

export type CardsAction =
  | { type: 'updateCard'; key: string; changes: PostCardChange }
  | { type: 'addCard' }
  | { type: 'removeCard'; key: string };

/** Edits a post's cards: one card's text or photos, a new card at the end, a following card removed. */
export default function cardsReducer(draft: CardsDraft, action: CardsAction): CardsDraft {
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
  }
}
