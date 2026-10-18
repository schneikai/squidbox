import { describe, it, expect } from 'vitest';

import sortAlbumsByLastPostedDesc from '../src/features/album-list/actions/sort-albums-action/sortAlbumsByLastPostedDesc';

const album = (name: string, lastPostedAt: number | null) => ({ name, lastPostedAt });
const names = (albums: { name: string }[]) => albums.map((a) => a.name);

describe('albums by last posted, newest first', () => {
  it('lists the most recently posted first and the never posted last', () => {
    const albums = [album('never', null), album('old', 1), album('new', 3), album('mid', 2)];
    expect(names(albums.sort(sortAlbumsByLastPostedDesc))).toEqual(['new', 'mid', 'old', 'never']);
  });

  it('ties two never posted albums, so a second order can break the tie', () => {
    expect(sortAlbumsByLastPostedDesc(album('a', null), album('b', null))).toBe(0);
    expect(sortAlbumsByLastPostedDesc(album('a', 2), album('b', 2))).toBe(0);
  });
});
