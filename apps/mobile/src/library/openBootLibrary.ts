import { rebuildRegistry } from './rebuildRegistry';
import { loadRegistry } from './registry';
import type { Session } from './session';
import { openLibraryForSession } from './sessionLibrary';
import { switchLibrary } from './switchLibrary';

import { openAppDb } from '@/sync/db/client';
import { getSessionAsync } from '@/utils/cloud-api/sessionStore';

// Boot: load the library list (rebuilt from the databases when there is none) and open the
// session's library, without the network; the cloud init verifies the session meanwhile.
export async function openBootLibrary(): Promise<void> {
  await loadRegistry(() => rebuildRegistry({ openDb: openAppDb }));
  const session = (await getSessionAsync()) as Session | null;
  await openLibraryForSession(session, session, switchLibrary);
}
