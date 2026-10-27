import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * The posts the user's writing model writes for the assistant chat: `body` is `{ context, messages }`
 * (chatRequestSchema), the whole chat so far ending with the user's new turn. `signal` stops it.
 */
export default async function chatAsync(body, { signal } = {}) {
  const { data } = await apiWithAuthentication.post('ai/chat', body, { timeout: AI_REQUEST_TIMEOUT_MS, signal });
  return data.tweets;
}
