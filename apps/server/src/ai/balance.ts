// The Venice account's balance, read with the same key the compares spend.
import type { AiBalanceResponse } from '@squidbox/shared';
import { z } from 'zod';
import { veniceFetch } from './venice.js';

const FETCH_TIMEOUT_MS = 15_000;

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
  const response = await veniceFetch('/api_keys/rate_limits', { timeoutMs: FETCH_TIMEOUT_MS });
  if (!response.ok) throw new Error(`Venice balance failed (${response.status})`);
  const { data } = rateLimitsSchema.parse(await response.json());
  return { usd: data.balances.USD, diem: data.balances.DIEM, nextResetAt: data.nextEpochBegins };
}
