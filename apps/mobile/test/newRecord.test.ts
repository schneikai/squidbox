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

  // The next two guard a caller the types don't hold to one collection's fields (userRecord picks
  // its collection by name), so they call it past the types.
  it('drops keys the collection has no field for', () => {
    expect(
      newRecord(albumCollection, defaults, {
        // @ts-expect-error -- the rule under test: a key the collection has no field for
        assets: ['a'],
      }),
    ).not.toHaveProperty('assets');
  });

  it('throws on a wrong field', () => {
    expect(() =>
      newRecord(albumCollection, defaults, {
        // @ts-expect-error -- the rule under test: a value the schema rejects
        sortOrder: 'name',
      }),
    ).toThrow();
  });
});
