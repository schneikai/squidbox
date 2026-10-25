import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

// The server's AI endpoints (apps/server/src/ai/routes.ts). A compare waits on the slowest model,
// so it gets more than the instance's 15 s.
const COMPARE_TIMEOUT_MS = 120_000;

/** Every model Venice offers now (ApiAiModel[]). */
export async function fetchAiModelsAsync() {
  const { data } = await apiWithAuthentication.get('ai/models');
  return data.models;
}

/** `{ prompt, modelIds }` → each model's `{ modelId, tweets }` or `{ modelId, error }`. */
export async function compareWritingAsync(body, { signal } = {}) {
  const { data } = await apiWithAuthentication.post('ai/compare/writing', body, {
    timeout: COMPARE_TIMEOUT_MS,
    signal,
  });
  return data.results;
}

/** `{ image: { base64, mimeType }, modelIds }` → each model's `{ modelId, tags }` or `{ modelId, error }`. */
export async function compareVisionAsync(body, { signal } = {}) {
  const { data } = await apiWithAuthentication.post('ai/compare/vision', body, { timeout: COMPARE_TIMEOUT_MS, signal });
  return data.results;
}
