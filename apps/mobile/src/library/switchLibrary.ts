import { readUnsyncedCounts } from './atRiskCount';
import { closeLibrary, getLibrary, openLibrary, openLibraryId } from './current';
import { createLibraryFolders } from './fs';
import { libraryPaths } from './libraryPaths';
import { getRegistry, updateRegistry, type Library } from './registry';

import { deleteAppDb, getDb } from '@/sync/db/client';

// Closes the open library (if any) and opens `target`, inside the caller's paused sync section
// (which stopped the sync and backup runs): the closing library's unsynced counts are noted for
// display, then the target opens with its folders and joins the list if new. If the target won't
// open, a file it was just creating is deleted (so it holds no storage), the previous library is
// reopened and the error rethrown; a library that never opened gets no entry.
export async function switchLibrary(target: Library): Promise<void> {
  const previous = getRegistry().libraries.find(({ id }) => id === openLibraryId());
  const creating = !getRegistry().libraries.some(({ id }) => id === target.id);
  const closed = previous && { ...(await readUnsyncedCounts(getDb())), at: Date.now() };
  if (previous) await closeLibrary();

  try {
    await openLibrary(target);
    await createLibraryFolders(getLibrary());
  } catch (error) {
    await closeLibrary().catch(() => {});
    if (creating) await deleteAppDb(libraryPaths(target.id).dbName);
    if (previous) await openLibrary(previous);
    throw creating
      ? new Error(`Couldn't create the library: ${error instanceof Error ? error.message : error}`)
      : error;
  }

  await updateRegistry(({ libraries }) => ({
    libraries: [...libraries, ...(creating ? [target] : [])].map((library) => {
      if (library.id === previous?.id) return { ...library, closed };
      if (library.id === target.id && library.closed) return withoutClosed(library);
      return library;
    }),
  }));
}

function withoutClosed({ closed: _closed, ...library }: Library): Library {
  return library;
}
