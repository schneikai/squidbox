import type { AccountFeature } from '@squidbox/shared';

import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useOpenLibrary from '@/library/useOpenLibrary';

/**
 * The account an Assistant screen edits for, while the screen is available (useLeaveWhenUnavailable,
 * which goes back once it isn't); null otherwise. Available already means an account
 * (useIsAssistantAvailable): the null only narrows.
 */
export default function useAvailableUserId(feature?: AccountFeature): string | null {
  const isAvailable = useLeaveWhenUnavailable(feature);
  const { userId } = useOpenLibrary();
  return isAvailable ? userId : null;
}
