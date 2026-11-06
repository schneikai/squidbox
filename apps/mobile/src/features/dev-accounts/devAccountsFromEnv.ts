import { loginRequestSchema, z } from '@squidbox/shared';

const devAccountSchema = loginRequestSchema.extend({
  label: z.string(),
  isLiveLibraryCopy: z.boolean().optional(),
});

export type DevAccount = z.infer<typeof devAccountSchema>;

/**
 * The local backend's accounts from `EXPO_PUBLIC_DEV_ACCOUNTS` (the JSON the repo root's
 * scripts/dev.mjs writes): none when unset, and an entry without its sign-in (the library copy's
 * email or password left out of the server's env) is left out.
 */
export default function devAccountsFromEnv(json: string | undefined): DevAccount[] {
  if (!json) return [];
  const parsed: unknown = JSON.parse(json);
  const entries: unknown[] = Array.isArray(parsed) ? parsed : [];
  return entries.flatMap((entry) => {
    const account = devAccountSchema.safeParse(entry);
    return account.success ? [account.data] : [];
  });
}
