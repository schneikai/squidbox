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
// opens while the cloud init verifies the session over the network. The boot ends once the
// init has; an init failure never stops it.
export async function bootLibrary(switchLibrary: (target: Library) => Promise<void>): Promise<void> {
  await loadSessionAsync();
  await loadRegistry(rebuildRegistry);
  const verified = initializeCloudAsync().catch((error) => Sentry.captureException(error));
  await resolveOwners();
  await backfillMergeMarkers();
  await openLibraryForSession(getSession(), switchLibrary);
  await verified;
}
