import { listDatabaseNames } from './fs';
import { MIGRATED_LIBRARY_ID, libraryIdFromDbName } from './libraryPaths';
import type { Owner } from './owner';
import type { Library, Registry } from './registry';

import type { AppDb } from '@/sync/db/driver';
import { getLastSyncUser, getOwner, setOwner } from '@/sync/status';
import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import { getSessionAsync, setSessionAsync } from '@/utils/cloud-api/sessionStore';

interface Session {
  userId: string | null;
  email: string | null;
}

// Recreates the library list from the databases on the device: each one's owner is stored inside
// it. The install from before libraries (squidbox.db) has none yet and gets it from whose data it
// held: the last synced account, or this device when nobody ever synced. A signed-out account owner
// gets a token-less session, so they boot into their data with the sign-in form, not into an empty
// device library. Nothing on disk is moved or deleted, so a crash at any point re-runs to the same
// result.
export async function rebuildRegistry({ openDb }: { openDb: (dbName: string) => Promise<AppDb> }): Promise<Registry> {
  const session = (await getSessionAsync()) as Session | null;
  const libraries: Library[] = [];
  for (const dbName of await listDatabaseNames()) {
    const id = libraryIdFromDbName(dbName);
    if (!id) continue;
    const db = await openDb(dbName);
    try {
      libraries.push({ id, owner: await ensureOwner(db, session) });
    } finally {
      await db.close();
    }
  }

  const migrated = libraries.find((library) => library.id === MIGRATED_LIBRARY_ID);
  if (!session && migrated?.owner.kind === 'account') {
    const { serverId, userId, email } = migrated.owner;
    await setSessionAsync({ serverId, userId, email, apiBaseUrl: API_BASE_URL, tokens: null });
  }
  return { libraries };
}

async function ensureOwner(db: AppDb, session: Session | null): Promise<Owner> {
  const stored = await getOwner(db);
  if (stored) return stored;
  const owner = await ownerFromSyncState(db, session);
  await setOwner(db, owner);
  return owner;
}

async function ownerFromSyncState(db: AppDb, session: Session | null): Promise<Owner> {
  const userId = await getLastSyncUser(db);
  if (!userId) return { kind: 'device' };
  const email = session?.userId === userId ? (session.email ?? '') : '';
  return { kind: 'account', serverId: null, userId, email };
}
