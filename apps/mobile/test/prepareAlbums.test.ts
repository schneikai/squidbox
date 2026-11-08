import { describe, expect, it } from 'vitest';

import type { AlbumListRow } from '../src/features/album-list/albumQuery';
import prepareAlbums from '../src/features/album-list/prepareAlbums';

// Only what prepareAlbums reads of a row.
const album = (id: string, name: string) =>
  ({ id, name, createdAt: 1, smartAlbumType: null, isFavorite: false, archivedAt: null }) as unknown as AlbumListRow;

describe('prepareAlbums', () => {
  it('a search ignores spaces around the text', () => {
    const albums = [album('a', 'Trail runs'), album('b', 'Summits')];
    const shown = prepareAlbums({ albums, sortOrder: 'createdAt:desc', searchText: ' trail ' });
    expect(shown.map((row) => row.id)).toEqual(['a']);
  });
});
