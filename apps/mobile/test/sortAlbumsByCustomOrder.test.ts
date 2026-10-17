import { initialKeys, keyBetween } from '@squidbox/shared';
import { describe, it, expect } from 'vitest';

import sortAlbumsByCustomOrder from '../src/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';

const album = (name: string, createdAt: number, position: string | null = null) => ({ name, createdAt, position });
const names = (albums: { name: string }[]) => albums.map((a) => a.name);

describe('albums custom order', () => {
  it('without positions it is newest first, as before', () => {
    const albums = [album('old', 1), album('new', 3), album('mid', 2)];
    expect(names(albums.sort(sortAlbumsByCustomOrder))).toEqual(['new', 'mid', 'old']);
  });

  it('places albums by position, with albums never placed (new ones) first', () => {
    const [a, b, c] = initialKeys(3);
    const albums = [album('230', 1, c!), album('fresh', 9), album('210', 2, a!), album('220', 3, b!)];
    expect(names(albums.sort(sortAlbumsByCustomOrder))).toEqual(['fresh', '210', '220', '230']);
  });

  it('a position between two others lands between them', () => {
    const [a, b] = initialKeys(2);
    const albums = [album('first', 1, a!), album('last', 2, b!), album('between', 3, keyBetween(a!, b!))];
    expect(names(albums.sort(sortAlbumsByCustomOrder))).toEqual(['first', 'between', 'last']);
  });

  it('breaks ties by id, also among never-placed albums made at the same time, so every sort agrees', () => {
    const [a] = initialKeys(1);
    const rows = [
      { id: 'z', name: 'z', createdAt: 5, position: null },
      { id: 'y', name: 'y', createdAt: 5, position: null },
      { id: 'q', name: 'q', createdAt: 1, position: a! },
      { id: 'p', name: 'p', createdAt: 2, position: a! },
    ];
    expect(names([...rows].sort(sortAlbumsByCustomOrder))).toEqual(['y', 'z', 'p', 'q']);
    expect(names([...rows].reverse().sort(sortAlbumsByCustomOrder))).toEqual(['y', 'z', 'p', 'q']);
  });
});
