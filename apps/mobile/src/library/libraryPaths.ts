// Where a library's data lives, derived from its id alone, so no stored value can name a path.
// The install that existed before libraries keeps its original names.
export const MIGRATED_LIBRARY_ID = 'squidbox';
const MIGRATED_DB_NAME = 'squidbox.db';

export interface LibraryPaths {
  dbName: string;
  filesDir: string; // relative to the app's document directory
  thumbnailsDir: string;
  downloadsDir: string; // relative to the app's cache directory: full-resolution files fetched to save or view
}

export function libraryPaths(id: string): LibraryPaths {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid library id: ${id}`);
  const downloadsDir = `downloads/${id}/`;
  if (id === MIGRATED_LIBRARY_ID) {
    return { dbName: MIGRATED_DB_NAME, filesDir: 'assetfiles/', thumbnailsDir: 'assetthumbnails/', downloadsDir };
  }
  return {
    dbName: `library-${id}.db`,
    filesDir: `libraries/${id}/files/`,
    thumbnailsDir: `libraries/${id}/thumbnails/`,
    downloadsDir,
  };
}

// The id of the library a database file belongs to, or null for any other file.
export function libraryIdFromDbName(dbName: string): string | null {
  if (dbName === MIGRATED_DB_NAME) return MIGRATED_LIBRARY_ID;
  return /^library-([a-z0-9-]+)\.db$/.exec(dbName)?.[1] ?? null;
}
