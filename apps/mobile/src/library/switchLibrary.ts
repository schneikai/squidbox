import { readUnsyncedCounts } from './atRiskCount';
import { closeLibrary, getLibrary, isLibraryOpen, openLibrary } from './current';
import { createLibraryFolders } from './fs';
import { libraryPaths } from './libraryPaths';
import { getRegistry, updateLibrary, updateRegistry, type Library } from './registry';

import { stopBackup } from '@/sync/backupRun';
import { deleteAppDb, getDb } from '@/sync/db/client';

// Closes the open library (if any) and opens `target`, inside the caller's paused sync section:
// the backup run is stopped and awaited, the closing library's unsynced counts are noted for
// display, then the target opens with its folders and joins the list if new. If the target won't
// open, a file it was just creating is deleted (so it holds no storage), the previous library is
// reopened and the error rethrown; a library that never opened gets no entry.
export async function switchLibrary(target: Library): Promise<void> {
  const previous = isLibraryOpen() ? getRegistry().libraries.find(({ id }) => id === getLibrary().id) : undefined;
  const creating = !getRegistry().libraries.some(({ id }) => id === target.id);

  await stopBackup();
  if (previous) {
    const counts = await readUnsyncedCounts(getDb());
    await updateLibrary(previous.id, (library) => ({ ...library, closed: { ...counts, at: Date.now() } }));
    await closeLibrary();
  }

  try {
    await openLibrary(target);
    await createLibraryFolders(getLibrary());
    if (creating) await updateRegistry(({ libraries }) => ({ libraries: [...libraries, target] }));
    else await updateLibrary(target.id, ({ closed: _closed, ...library }) => library);
  } catch (error) {
    await closeLibrary().catch(() => {});
    if (creating) await deleteAppDb(libraryPaths(target.id).dbName);
    if (previous) await openLibrary(previous);
    throw error;
  }
}
