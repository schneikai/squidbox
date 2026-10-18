import { listDatabaseNames } from './fs';
import { libraryIdFromDbName } from './libraryPaths';
import type { Library, Registry } from './registry';

import { withAppDb } from '@/sync/db/client';
import { getOwner } from '@/sync/status';

// Recreates the library list from the databases on the device: each one's owner is stored inside
// it. One without (a library from before owners were stored) becomes this device's library, so its
// photos stay in reach; any further one is skipped. Nothing on disk is moved or deleted.
export async function rebuildRegistry(): Promise<Registry> {
  const libraries: Library[] = [];
  const ownerless: Library[] = [];
  for (const dbName of await listDatabaseNames()) {
    const id = libraryIdFromDbName(dbName);
    if (!id) continue;
    const owner = await withAppDb(dbName, getOwner);
    if (owner) libraries.push({ id, owner });
    else ownerless.push({ id, owner: { kind: 'device' } });
  }
  if (ownerless.length && !libraries.some(({ owner }) => owner.kind === 'device')) libraries.push(ownerless[0]);
  return { libraries };
}
