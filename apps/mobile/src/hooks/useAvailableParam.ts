import type { AccountFeature } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';

import useCloseWhen from '@/hooks/useCloseWhen';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';

// What the hook needs of a zod schema: a parse that says whether the value fits.
type ParamSchema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

/**
 * The route param `name` of an Assistant screen as `schema` parses it, while the screen is available
 * (useLeaveWhenUnavailable, with `feature` when it needs one): the value, or null when the screen is
 * leaving: it isn't available (useLeaveWhenUnavailable goes back), or the link's value doesn't parse
 * (an old or mistyped link; this goes back).
 */
export default function useAvailableParam<T>(name: string, schema: ParamSchema<T>, feature?: AccountFeature): T | null {
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = schema.safeParse(params[name]);
  const isAvailable = useLeaveWhenUnavailable(feature);
  // Only while available: useLeaveWhenUnavailable closes it otherwise.
  useCloseWhen(isAvailable && !parsed.success);
  return isAvailable && parsed.success ? parsed.data : null;
}
