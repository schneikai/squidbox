import { albumCollection } from '@squidbox/shared';
import { describe, it, expect } from 'vitest';

import newRecord from '../src/utils/newRecord';

const defaults = {
  name: 'New Album',
  isFavorite: false,
  archivedAt: null,
  showInPostSuggestionsAfter: null,
  oldCollectionName: null,
  notes: null,
  sortOrder: null,
  smartAlbumType: null,
};

describe('newRecord', () => {
  it('fills the base columns and the defaults under the given fields', () => {
    const album = newRecord(albumCollection, defaults, { name: 'Trips', notes: undefined });
    expect(album).toMatchObject({ ...defaults, name: 'Trips', deletedAt: null });
    expect(album.createdAt).toBe(album.updatedAt);
    expect(album.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('drops keys the collection has no field for', () => {
    expect(newRecord(albumCollection, defaults, { assets: ['a'] })).not.toHaveProperty('assets');
  });

  it('throws on a wrong field', () => {
    expect(() => newRecord(albumCollection, defaults, { sortOrder: 'name' })).toThrow();
  });
});
