import useHasFeature from '@/hooks/useHasFeature';
import useLibrary from '@/library/useLibrary';
import isTestBuild from '@/utils/isTestBuild';

/**
 * Whether Settings → Assistant shows: in a test build, in an account's library whose owner is
 * signed in (the AI endpoints need a session, and the model testing's memory lives in the library)
 * and has the `ai` feature (the server answers 403 without it).
 */
export default function useIsAssistantAvailable() {
  const { library } = useLibrary();
  const hasAi = useHasFeature('ai');
  return isTestBuild() && library.owner.kind === 'account' && hasAi;
}
