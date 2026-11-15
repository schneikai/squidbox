import type { CardsDraft } from './cardsReducer';

/** The key the next card added to `draft` takes (addCard). */
export default function nextCardKey(draft: Pick<CardsDraft, 'nextCard'>): string {
  return `card-${draft.nextCard}`;
}
