import type { AccountFeature } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';

import useAvailableUserId from '@/hooks/useAvailableUserId';
import useCloseWhen from '@/hooks/useCloseWhen';

// What the hook needs of a zod schema: a parse that says whether the value fits.
type ParamSchema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

/**
 * The route param `name` of an Assistant screen as `schema` parses it, while the screen is available
 * (useAvailableUserId, with `feature` when it needs one): `{ value, userId }`, or null when the
 * screen is leaving: it isn't available (useAvailableUserId goes back), or the link's value doesn't
 * parse (an old or mistyped link; this goes back).
 */
export default function useAvailableParam<T>(
  name: string,
  schema: ParamSchema<T>,
  feature?: AccountFeature,
): { value: T; userId: string } | null {
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = schema.safeParse(params[name]);
  const userId = useAvailableUserId(feature);
  // Only while available: useAvailableUserId closes it otherwise.
  useCloseWhen(userId !== null && !parsed.success);
  return userId !== null && parsed.success ? { value: parsed.data, userId } : null;
}
