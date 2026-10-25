import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/** What is left on the server's Venice account: `{ usd, diem, nextResetAt }`. */
export default async function fetchAiBalanceAsync() {
  const { data } = await apiWithAuthentication.get('ai/balance');
  return data;
}
