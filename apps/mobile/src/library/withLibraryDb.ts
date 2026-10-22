import { openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';

import { getDb, withAppDb } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';

// A library's database: the open one as it is (never opened a second time), a parked one on its own
// connection, closed again afterwards.
export function withLibraryDb<T>(id: string, use: (db: SyncDb) => Promise<T>): Promise<T> {
  if (openLibraryId() === id) return use(getDb());
  return withAppDb(libraryPaths(id).dbName, use);
}
