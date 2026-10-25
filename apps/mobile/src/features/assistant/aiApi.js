import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

// The server's AI endpoints (apps/server/src/ai/routes.ts). A compare waits on the slowest model,
// so it gets more than the instance's 15 s.
const COMPARE_TIMEOUT_MS = 180_000;

/** Every model Venice offers now (ApiAiModel[]). */
export async function fetchAiModelsAsync() {
  const { data } = await apiWithAuthentication.get('ai/models');
  return data.models;
}

/** What is left on the Venice account: `{ usd, diem, nextResetAt }`. */
export async function fetchAiBalanceAsync() {
  const { data } = await apiWithAuthentication.get('ai/balance');
  return data;
}

/**
 * A blind compare of `kind`: writing `{ prompt, modelIds }`, vision `{ prompt, image: { base64,
 * mimeType }, modelIds }` → each model's `{ modelId, tweets | tags }` or `{ modelId, error }`.
 */
export async function compareAsync(kind, body, { signal } = {}) {
  const { data } = await apiWithAuthentication.post(`ai/compare/${kind}`, body, {
    timeout: COMPARE_TIMEOUT_MS,
    signal,
  });
  return data.results;
}
