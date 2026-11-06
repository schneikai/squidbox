import { collectionsByName } from '@squidbox/shared';

import type { LibraryPaths } from './libraryPaths';

/** A library folder that holds a file field's files: its key in LibraryPaths. */
export type FileFolder = keyof Pick<LibraryPaths, 'avatarsDir'>;

export interface FileFieldLocation {
  folder: FileFolder;
  label: string; // what an error calls one of its files
}

// Where each file field (a descriptor's `fileFields`, sync-design §9) keeps its files on this device.
// The one list the folders, the sync's uploads, the loader and the library merge read.
export const FILE_FIELDS: Record<string, FileFieldLocation> = {
  'contacts.avatarFilename': { folder: 'avatarsDir', label: 'Contact photo' },
};

// Every folder that holds a file field's files: made and removed with the library's other folders.
export const FILE_FOLDERS: FileFolder[] = [...new Set(Object.values(FILE_FIELDS).map(({ folder }) => folder))];

/**
 * Whether a file field's value is a plain file name that stays inside its folder (letters, digits,
 * `.`, `_` and `-`, not starting with a dot): the synced value is joined into a path on this device.
 */
export function isFileName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && !name.includes('..');
}

/** Where a file field keeps its files; throws for a field with no folder on this device. */
export function fileFieldLocation(collection: string, field: string): FileFieldLocation {
  const location = FILE_FIELDS[`${collection}.${field}`];
  if (!location) throw new Error(`No folder on this device for the files of ${collection}.${field}`);
  return location;
}

/** A collection's file fields, each with where its files live (none for most collections). */
export function fileFieldsOf(collection: string): ({ field: string } & FileFieldLocation)[] {
  return (collectionsByName[collection]?.fileFields ?? []).map((field) => ({
    field,
    ...fileFieldLocation(collection, field),
  }));
}
