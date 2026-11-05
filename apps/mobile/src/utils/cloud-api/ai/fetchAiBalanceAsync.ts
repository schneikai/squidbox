import type { AiBalanceResponse } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/** What is left on the server's Venice account: `{ usd, diem, nextResetAt }`. */
export default async function fetchAiBalanceAsync(): Promise<AiBalanceResponse> {
  const { data } = await apiWithAuthentication.get<AiBalanceResponse>('ai/balance');
  return data;
}
