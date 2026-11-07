import { describe, expect, it } from 'vitest';

import sortContactLists from '../src/features/contact-list-picker/sortContactLists';

const lists = [
  { id: 'berlin', name: 'Berlin', createdAt: 1 },
  { id: 'have-met', name: 'Have Met', createdAt: 2 },
  { id: 'lyon', name: 'Lyon', createdAt: 3 },
];
const ids = (sorted: typeof lists) => sorted.map((list) => list.id);

describe('sortContactLists', () => {
  it('puts the newest list first, as Recently added does for contacts', () => {
    expect(ids(sortContactLists(lists, 'createdAt:desc'))).toEqual(['lyon', 'have-met', 'berlin']);
  });
});
