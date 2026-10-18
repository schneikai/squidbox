import { listDatabaseNames } from './fs';
import { libraryIdFromDbName } from './libraryPaths';
import type { Library, Registry } from './registry';

import { withAppDb } from '@/sync/db/client';
import { getOwner } from '@/sync/status';

// Recreates the library list from the databases on the device: each one's owner is stored inside
// it. A database without one is skipped: only a first open that crashed before writing the owner
// leaves one, and it holds nothing. Nothing on disk is moved or deleted.
export async function rebuildRegistry(): Promise<Registry> {
  const libraries: Library[] = [];
  for (const dbName of await listDatabaseNames()) {
    const id = libraryIdFromDbName(dbName);
    if (!id) continue;
    const owner = await withAppDb(dbName, getOwner);
    if (owner) libraries.push({ id, owner });
  }
  return { libraries };
}
