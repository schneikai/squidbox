import { describe, expect, it } from 'vitest';

import shownContactLists from '../src/features/contact-list/shownContactLists';

const lists = [
  { id: 'lyon', name: 'Lyon', createdAt: 3 },
  { id: 'tagged', name: 'Tagged', createdAt: 0 },
  { id: 'berlin', name: 'berlin', createdAt: 1 },
  { id: 'have-met', name: 'Have Met', createdAt: 2 },
];
const ids = (shown: typeof lists) => shown.map((list) => list.id);

describe('shownContactLists', () => {
  it('sorts by name whatever the case, the built-in lists among the others', () => {
    expect(ids(shownContactLists(lists, '', 'name:asc'))).toEqual(['berlin', 'have-met', 'lyon', 'tagged']);
  });

  it('puts the newest list first, as Recently added does for contacts', () => {
    expect(ids(shownContactLists(lists, '', 'createdAt:desc'))).toEqual(['lyon', 'have-met', 'berlin', 'tagged']);
  });

  it('shows only the lists whose name matches the search', () => {
    expect(ids(shownContactLists(lists, ' BER', 'name:asc'))).toEqual(['berlin']);
  });
});
