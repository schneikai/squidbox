import * as Sentry from '@sentry/react-native';

import { rebuildRegistry } from './rebuildRegistry';
import { loadRegistry, type Library } from './registry';
import { openLibraryForSession } from './sessionLibrary';

import initializeCloudAsync from '@/utils/cloud-api/initializeCloudAsync';
import { getSession, loadSessionAsync } from '@/utils/cloud-api/sessionStore';

// The one boot sequence: the stored session and the library list (rebuilt from the databases when
// there is none; the rebuild may store a token-less session for a signed-out owner, so the session
// is read after it), then the session's library opens while the cloud init verifies the session
// over the network; the verified session then settles the open library and its owner (a converted
// session that learned its user from /me may name another library; the switch then moves there).
// An init failure never stops the boot: the stored session stays as it is for this launch.
export async function bootLibrary(switchLibrary: (target: Library) => Promise<void>): Promise<void> {
  await loadSessionAsync();
  await loadRegistry(rebuildRegistry);
  const verified = initializeCloudAsync().catch((error) => {
    Sentry.captureException(error);
    return getSession();
  });
  await openLibraryForSession(getSession(), switchLibrary);
  await openLibraryForSession(await verified, switchLibrary);
}
