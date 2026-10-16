import { closeLibrary, getLibrary, openLibrary, openLibraryEntry } from './current';
import { createLibraryFolders, libraryLimitMessage } from './fs';
import { libraryPaths } from './libraryPaths';
import { getRegistry, updateRegistry, type Library } from './registry';

import { deleteAppDb } from '@/sync/db/client';

// Closes the open library (if any) and opens `target`, inside the caller's paused sync section
// (which stopped the sync and backup runs); the target opens with its folders and joins the list if
// new. If the target won't open, a file it was just creating is deleted (so it holds no storage),
// the previous library is reopened and the error rethrown (saying so when the browser had no room for
// its file); a library that never opened gets no entry.
// A previous library that won't reopen either leaves none open (LibraryProvider shows the boot
// error then); the error stays the switch's own.
export async function switchLibrary(target: Library): Promise<void> {
  const previous = openLibraryEntry();
  const creating = !getRegistry().libraries.some(({ id }) => id === target.id);
  if (previous) await closeLibrary();

  try {
    await openLibrary(target);
    await createLibraryFolders(getLibrary());
  } catch (error) {
    await closeLibrary().catch(() => {});
    if (creating) await deleteAppDb(libraryPaths(target.id).dbName);
    if (previous) await reopen(previous);
    if (!creating) throw error;
    throw new Error(
      libraryLimitMessage(error) ?? `Couldn't create the library: ${error instanceof Error ? error.message : error}`,
    );
  }

  if (creating) await updateRegistry(({ libraries }) => ({ libraries: [...libraries, target] }));
}

async function reopen(previous: Library): Promise<void> {
  try {
    await openLibrary(previous);
  } catch (error) {
    console.warn(`Could not reopen library ${previous.id}`, error);
  }
}
