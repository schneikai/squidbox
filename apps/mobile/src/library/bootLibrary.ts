import * as Sentry from '@sentry/react-native';

import { backfillMergeMarkers } from './backfillMergeMarkers';
import { rebuildRegistry } from './rebuildRegistry';
import { loadRegistry, type Library } from './registry';
import { resolveOwners } from './resolveOwners';
import { openLibraryForSession } from './sessionLibrary';

import initializeCloudAsync from '@/utils/cloud-api/initializeCloudAsync';
import { getSession, loadSessionAsync } from '@/utils/cloud-api/sessionStore';

// The one boot sequence: the stored session and the library list (rebuilt from the databases when
// there is none), an owner without its serverId resolved from the session, the list's merge markers
// copied into the databases (backfillMergeMarkers, before any merge runs), then the session's library
// opens (openLibraryForSession) while the cloud init verifies the session over the network. The boot
// ends once the init has, opening the library again when the init dropped the tokens (as every other
// loss of the tokens does, watchTokenDrops); an init failure never stops it.
export async function bootLibrary(switchLibrary: (target: Library) => Promise<void>): Promise<void> {
  await loadSessionAsync();
  await loadRegistry(rebuildRegistry);
  const verified = initializeCloudAsync().catch((error) => Sentry.captureException(error));
  await resolveOwners();
  await backfillMergeMarkers();
  const hadTokens = Boolean(getSession()?.tokens);
  await openLibraryForSession(getSession(), switchLibrary);
  await verified;
  if (hadTokens && !getSession()?.tokens) await openLibraryForSession(getSession(), switchLibrary);
}
