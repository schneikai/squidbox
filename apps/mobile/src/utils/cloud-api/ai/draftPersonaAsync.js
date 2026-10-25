import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

// A draft waits on one model reading up to 40 posts, so it gets more than the instance's 15 s.
const DRAFT_TIMEOUT_MS = 180_000;

/**
 * "Fill it in for me": `{ posts, modelId }` → the model's `{ aboutYou, contentTags, tone,
 * examplePostIndexes }` (indexes into `posts`).
 */
export default async function draftPersonaAsync(body, { signal } = {}) {
  const { data } = await apiWithAuthentication.post('ai/persona/draft', body, { timeout: DRAFT_TIMEOUT_MS, signal });
  return data;
}
