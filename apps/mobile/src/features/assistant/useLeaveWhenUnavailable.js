import useIsAssistantAvailable from './useIsAssistantAvailable';

import useCloseWhen from '@/hooks/useCloseWhen';

/** Goes back from an Assistant screen once it isn't available anymore (a sign-out, say). */
export default function useLeaveWhenUnavailable() {
  const isAvailable = useIsAssistantAvailable();
  useCloseWhen(!isAvailable);
  return isAvailable;
}
