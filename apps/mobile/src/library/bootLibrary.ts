import * as Sentry from '@sentry/react-native';

import { rebuildRegistry } from './rebuildRegistry';
import { loadRegistry, type Library } from './registry';
import { openLibraryForBoot } from './sessionLibrary';

import { openAppDb } from '@/sync/db/client';
import initializeCloudAsync from '@/utils/cloud-api/initializeCloudAsync';
import { getSession, loadSessionAsync } from '@/utils/cloud-api/sessionStore';

// The one boot sequence: the stored session and the library list (rebuilt from the databases when
// there is none), then the session's library opens while the cloud init verifies the session over
// the network; the verified session then settles the open library and its owner. An init failure
// never stops the boot: the stored session stays as it is for this launch.
export async function bootLibrary(switchLibrary: (target: Library) => Promise<void>): Promise<void> {
  const session = await loadSessionAsync();
  await loadRegistry(() => rebuildRegistry({ openDb: openAppDb }));
  const verified = initializeCloudAsync().catch((error) => {
    Sentry.captureException(error);
    return getSession();
  });
  await openLibraryForBoot(session, verified, switchLibrary);
}
