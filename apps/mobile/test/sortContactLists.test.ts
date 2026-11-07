import { describe, expect, it } from 'vitest';

import sortContactLists from '../src/features/contact-list-picker/sortContactLists';

const lists = [
  { id: 'berlin', name: 'Berlin', memberCount: 3, createdAt: 1 },
  { id: 'have-met', name: 'Have Met', memberCount: 32, createdAt: 2 },
  { id: 'lyon', name: 'Lyon', memberCount: 3, createdAt: 3 },
];
const ids = (sorted: typeof lists) => sorted.map((list) => list.id);

describe('sortContactLists', () => {
  it('puts the lists with the most contacts first, by name where they tie', () => {
    expect(ids(sortContactLists(lists, 'memberCount:desc'))).toEqual(['have-met', 'berlin', 'lyon']);
  });

  it('puts the newest list first', () => {
    expect(ids(sortContactLists(lists, 'createdAt:desc'))).toEqual(['lyon', 'have-met', 'berlin']);
  });
});
