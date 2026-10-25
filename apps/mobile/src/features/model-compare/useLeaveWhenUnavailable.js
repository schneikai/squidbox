import useIsAssistantAvailable from './useIsAssistantAvailable';

import useCloseWhenGone from '@/hooks/useCloseWhenGone';

/** Goes back from an Assistant screen once it isn't available anymore (a sign-out, say). */
export default function useLeaveWhenUnavailable() {
  const isAvailable = useIsAssistantAvailable();
  useCloseWhenGone(isAvailable ? true : null);
  return isAvailable;
}
