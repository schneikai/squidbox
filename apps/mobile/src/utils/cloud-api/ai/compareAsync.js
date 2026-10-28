import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * A blind compare of `kind`: writing `{ prompt, modelIds }`, vision `{ prompt, image: { base64,
 * mimeType }, modelIds }` → each model's `{ modelId, tweets | tags }` or `{ modelId, error }`.
 */
export default async function compareAsync(kind, body, { signal } = {}) {
  const { data } = await apiWithAuthentication.post(`ai/compare/${kind}`, body, {
    timeout: AI_REQUEST_TIMEOUT_MS,
    signal,
  });
  return data.results;
}
