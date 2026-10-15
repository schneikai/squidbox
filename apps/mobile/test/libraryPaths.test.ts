import { describe, it, expect } from 'vitest';

import { assertLibraryId, libraryIdFromDbName, libraryPaths, MIGRATED_LIBRARY_ID } from '../src/library/libraryPaths';

describe('libraryPaths', () => {
  it('the migrated library keeps the names from before libraries', () => {
    expect(libraryPaths(MIGRATED_LIBRARY_ID)).toEqual({
      dbName: 'squidbox.db',
      filesDir: 'assetfiles/',
      thumbnailsDir: 'assetthumbnails/',
    });
  });

  it('any other library lives under its id', () => {
    expect(libraryPaths('3f2a-b1')).toEqual({
      dbName: 'library-3f2a-b1.db',
      filesDir: 'libraries/3f2a-b1/files/',
      thumbnailsDir: 'libraries/3f2a-b1/thumbnails/',
    });
  });

  it('refuses an id that could name another path', () => {
    for (const id of ['', '../x', 'a/b', 'A1', 'a b', 'a.db']) {
      expect(() => assertLibraryId(id)).toThrow('Invalid library id');
      expect(() => libraryPaths(id)).toThrow('Invalid library id');
    }
  });

  it('maps a database file back to its library', () => {
    expect(libraryIdFromDbName('squidbox.db')).toBe('squidbox');
    expect(libraryIdFromDbName('library-3f2a-b1.db')).toBe('3f2a-b1');
    expect(libraryIdFromDbName('squidbox.db-journal')).toBeNull();
    expect(libraryIdFromDbName('library-3f2a-b1.db-wal')).toBeNull();
    expect(libraryIdFromDbName('other.db')).toBeNull();
  });
});
