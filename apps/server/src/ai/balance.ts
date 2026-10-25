// The Venice account's balance, read with the same key the compares spend.
import type { AiBalanceResponse } from '@squidbox/shared';
import { z } from 'zod';
import { veniceGetJson } from './venice.js';

// GET /api_keys/rate_limits answers the key's limits and the account's balances (an inference key
// may read it; /billing/balance needs an admin key).
const rateLimitsSchema = z.object({
  data: z.object({
    balances: z.object({ USD: z.number().default(0), DIEM: z.number().default(0) }),
    nextEpochBegins: z.string().nullable().default(null),
  }),
});

/** What is left on the account. Throws when Venice doesn't answer it. */
export async function fetchBalanceAsync(): Promise<AiBalanceResponse> {
  const { data } = await veniceGetJson('/api_keys/rate_limits', rateLimitsSchema);
  return { usd: data.balances.USD, diem: data.balances.DIEM, nextResetAt: data.nextEpochBegins };
}
