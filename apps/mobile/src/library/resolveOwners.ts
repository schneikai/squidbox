import * as Sentry from '@sentry/react-native';

import { libraryPaths } from './libraryPaths';
import { getRegistry, updateLibrary } from './registry';

import { withAppDb } from '@/sync/db/client';
import { setOwner } from '@/sync/status';
import { getSession } from '@/utils/cloud-api/sessionStore';

// A converted install's account library may still have no serverId (its owner from before the
// server reported one). The stored session, once it knows both its user and server, lends them to
// that user's libraries, offline and before any library opens, so they match the session exactly.
export async function resolveOwners(): Promise<void> {
  const session = getSession();
  if (!session?.serverId || !session.userId) return;
  const { serverId, userId, email } = session;
  for (const library of getRegistry().libraries) {
    const { owner } = library;
    if (owner.kind !== 'account' || owner.serverId !== null || owner.userId !== userId) continue;
    const resolved = { ...owner, serverId, email: owner.email || email || '' };
    await withAppDb(libraryPaths(library.id).dbName, (db) => setOwner(db, resolved));
    await updateLibrary(library.id, (entry) => ({ ...entry, owner: resolved }));
    Sentry.captureMessage(`Resolved the owner of library ${library.id} at boot`);
  }
}
