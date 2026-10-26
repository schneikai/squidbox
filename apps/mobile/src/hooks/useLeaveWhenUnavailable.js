import useCloseWhen from '@/hooks/useCloseWhen';
import useHasFeature from '@/hooks/useHasFeature';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';

/**
 * Goes back from an Assistant screen once it isn't available anymore (a sign-out, say). A screen
 * that also needs a feature (`ai_admin` for Compare) names it.
 */
export default function useLeaveWhenUnavailable(feature) {
  const isAssistantAvailable = useIsAssistantAvailable();
  const hasFeature = useHasFeature(feature);
  const isAvailable = isAssistantAvailable && (!feature || hasFeature);
  useCloseWhen(!isAvailable);
  return isAvailable;
}
