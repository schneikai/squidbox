import * as Sentry from '@sentry/react-native';

import { rebuildRegistry } from './rebuildRegistry';
import { loadRegistry } from './registry';
import { openLibraryForSession, type SwitchLibrary } from './sessionLibrary';

import initializeCloudAsync from '@/utils/cloud-api/initializeCloudAsync';
import { getSession, loadSessionAsync } from '@/utils/cloud-api/sessionStore';

// The one boot sequence: the stored session and the library list (rebuilt from the databases when
// there is none), then the session's library opens (openLibraryForSession) while the cloud init
// verifies the session over the network. The boot ends once the init has, opening the library again
// when the init dropped the tokens: it stands in for watchTokenDrops, which LibraryProvider installs
// only after the boot. An init failure never stops the boot.
export async function bootLibrary(switchLibrary: SwitchLibrary): Promise<void> {
  await loadSessionAsync();
  await loadRegistry(rebuildRegistry);
  const verified = initializeCloudAsync().catch((error) => Sentry.captureException(error));
  const hadTokens = Boolean(getSession()?.tokens);
  await openLibraryForSession(getSession(), switchLibrary);
  await verified;
  if (hadTokens && !getSession()?.tokens) await openLibraryForSession(getSession(), switchLibrary);
}
