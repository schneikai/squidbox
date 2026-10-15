import { readUnsyncedCounts, type UnsyncedCounts } from './atRiskCount';
import { openLibraryId } from './current';
import { removeLibraryFolders } from './fs';
import { libraryPaths } from './libraryPaths';
import { updateRegistry } from './registry';

import { deleteAppDb, openAppDb } from '@/sync/db/client';

function assertParked(id: string): void {
  if (openLibraryId() === id) throw new Error('The open library cannot be removed');
}

// What a parked library would lose, counted from its own database right now (a crash can leave the
// snapshot in the list stale). Opened on a second connection, never through the open library.
export async function readParkedCounts(id: string): Promise<UnsyncedCounts> {
  assertParked(id);
  const db = await openAppDb(libraryPaths(id).dbName);
  try {
    return await readUnsyncedCounts(db);
  } finally {
    await db.close();
  }
}

// Deletes a parked library: its database, its folders and its entry. The paths come from the id
// alone (libraryPaths asserts its shape), so nothing stored can name another path.
export async function removeLibrary(id: string): Promise<void> {
  const paths = libraryPaths(id);
  assertParked(id);
  await deleteAppDb(paths.dbName);
  await removeLibraryFolders(paths);
  await updateRegistry(({ libraries }) => ({ libraries: libraries.filter((library) => library.id !== id) }));
}
