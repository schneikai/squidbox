import { listDatabaseNames } from './fs';
import { libraryIdFromDbName } from './libraryPaths';
import type { Owner } from './owner';
import type { Library, Registry } from './registry';

import { withAppDb } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import { getKeptFor, getMergeTarget, getOwner } from '@/sync/status';

// Recreates the library list from the databases on the device: each one's owner is stored inside
// it, and a device library's merge markers too (what it joins or joined, mergeRun.ts). One without (a library from before owners were stored) becomes this device's library, so its
// photos stay in reach; any further one is skipped. Nothing on disk is moved or deleted.
export async function rebuildRegistry(): Promise<Registry> {
  const libraries: Library[] = [];
  const ownerless: Library[] = [];
  for (const dbName of await listDatabaseNames()) {
    const id = libraryIdFromDbName(dbName);
    if (!id) continue;
    const { owner, ...markers } = await withAppDb(dbName, storedLibrary);
    if (owner) libraries.push({ id, owner, ...markers });
    else ownerless.push({ id, owner: { kind: 'device' }, ...markers });
  }
  if (ownerless.length && !libraries.some(({ owner }) => owner.kind === 'device')) libraries.push(ownerless[0]);
  return { libraries };
}

async function storedLibrary(db: SyncDb): Promise<Omit<Library, 'id' | 'owner'> & { owner: Owner | null }> {
  const [owner, mergedInto, keptFor] = await Promise.all([getOwner(db), getMergeTarget(db), getKeptFor(db)]);
  return { owner, ...(mergedInto && { mergedInto }), ...(keptFor && { keptFor }) };
}
