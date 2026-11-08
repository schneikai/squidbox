import { type AiModelKind, aiModelKindSchema } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';

import useCloseWhen from '@/hooks/useCloseWhen';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';

/**
 * The `kind` route param of a model screen (an ai_admin tool), while the screen is available: the
 * kind, or null when the screen is leaving: the assistant isn't available (useLeaveWhenUnavailable
 * goes back), or the link names an unknown kind (an old or mistyped link; this goes back).
 */
export default function useAvailableModelKind(): AiModelKind | null {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const parsed = aiModelKindSchema.safeParse(kind);
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  // Only while available: useLeaveWhenUnavailable closes it otherwise.
  useCloseWhen(isAvailable && !parsed.success);
  return isAvailable && parsed.success ? parsed.data : null;
}
