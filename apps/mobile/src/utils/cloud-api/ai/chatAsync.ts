import type { ChatRequest, ChatResponse } from '@squidbox/shared';

import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * The user's writing model's reply in the assistant chat, `{ reply, postOptions }` (chatReplySchema):
 * `body` is `{ chatId, context, messages }` (chatRequestSchema), the whole chat so far ending with the user's
 * new turn. `signal` stops it.
 */
export default async function chatAsync(
  body: ChatRequest,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ChatResponse> {
  const { data } = await apiWithAuthentication.post<ChatResponse>('ai/chat', body, {
    timeout: AI_REQUEST_TIMEOUT_MS,
    signal,
  });
  return data;
}
