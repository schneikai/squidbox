import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

// A compare waits on the slowest model, so it gets more than the instance's 15 s.
const COMPARE_TIMEOUT_MS = 180_000;

/**
 * A blind compare of `kind`: writing `{ prompt, modelIds }`, vision `{ prompt, image: { base64,
 * mimeType }, modelIds }` → each model's `{ modelId, tweets | tags }` or `{ modelId, error }`.
 */
export default async function compareAsync(kind, body, { signal } = {}) {
  const { data } = await apiWithAuthentication.post(`ai/compare/${kind}`, body, {
    timeout: COMPARE_TIMEOUT_MS,
    signal,
  });
  return data.results;
}
