import useHasFeature from '@/hooks/useHasFeature';
import useOpenLibrary from '@/library/useOpenLibrary';
import isTestBuild from '@/utils/isTestBuild';

/**
 * Whether Settings → Assistant shows: in a test build, in an account's library whose owner is
 * signed in (the AI endpoints need a session, and the model testing's memory lives in the library)
 * and has the `ai` feature (the server answers 403 without it).
 */
export default function useIsAssistantAvailable(): boolean {
  const { userId } = useOpenLibrary();
  const hasAi = useHasFeature('ai');
  return isTestBuild() && userId !== null && hasAi;
}
