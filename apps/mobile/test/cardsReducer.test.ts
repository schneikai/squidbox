import { describe, expect, it } from 'vitest';

import cardsReducer from '../src/features/posts/draft/cardsReducer';
import draftFromPost from '../src/features/posts/draft/draftFromPost';
import postData from '../src/features/posts/draft/postData';

const post = {
  text: 'Sunrise on the ridge',
  postAssets: [],
  threadPosts: [{ id: 't1', text: 'More from the trail', postAssets: [] }],
};

describe('cardsReducer', () => {
  it('saves an untouched draft as its seed, so Save stays off', () => {
    expect(postData(draftFromPost(post), 50)).toEqual({
      text: 'Sunrise on the ridge',
      assetRefs: [],
      postedAt: 50,
      threadPosts: [{ id: 't1', text: 'More from the trail', assetRefs: [] }],
    });
  });

  it('adds a card with a key of its own, also after a card was removed', () => {
    let draft = cardsReducer(draftFromPost(post), { type: 'addCard' });
    draft = cardsReducer(draft, { type: 'removeCard', key: draft.cards[2]!.key });
    draft = cardsReducer(draft, { type: 'addCard' });
    const keys = draft.cards.map((card) => card.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(postData(draft, 50).threadPosts.map((part) => part.id)).toEqual(['t1', null]);
  });

  it('never removes the first card', () => {
    const draft = draftFromPost(post);
    expect(cardsReducer(draft, { type: 'removeCard', key: draft.cards[0]!.key }).cards).toHaveLength(2);
  });

  it('changes only the card it is given', () => {
    const draft = draftFromPost(post);
    const changed = cardsReducer(draft, { type: 'updateCard', key: draft.cards[1]!.key, changes: { text: 'Edited' } });
    expect(changed.cards.map((card) => card.text)).toEqual(['Sunrise on the ridge', 'Edited']);
  });
});
