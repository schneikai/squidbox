import { openLibraryId } from './current';
import { removeLibraryFolders } from './fs';
import { libraryPaths } from './libraryPaths';
import { updateRegistry } from './registry';

import { deleteAppDb } from '@/sync/db/client';

// Deletes a parked library: its database, its folders and its entry. The paths come from the id
// alone (libraryPaths asserts its shape), so nothing stored can name another path.
export async function removeLibrary(id: string): Promise<void> {
  const paths = libraryPaths(id);
  if (openLibraryId() === id) throw new Error('The open library cannot be removed');
  await deleteAppDb(paths.dbName);
  await removeLibraryFolders(paths);
  await updateRegistry(({ libraries }) => ({ libraries: libraries.filter((library) => library.id !== id) }));
}
