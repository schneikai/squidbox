import isTestBuild from './isTestBuild';

import useCloud from '@/features/cloud/useCloud';
import useLibrary from '@/library/useLibrary';

/**
 * Whether Settings → Assistant shows: in a test build, in an account's library whose owner is
 * signed in (the AI endpoints need a session, and the model testing's memory lives in the library).
 */
export default function useIsAssistantAvailable() {
  const { isAuthenticated } = useCloud();
  const { library } = useLibrary();
  return isTestBuild() && library.owner.kind === 'account' && isAuthenticated;
}
