import type { ContactFromXProfileAiRequest, ContactFromXProfileAiResponse } from '@squidbox/shared';

import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * From link's assistant pass: what the user's writing model reads in an X profile's fields, as their
 * From link instructions ask: the Bluesky, OnlyFans and JFF handles they name and the location split
 * into `{ city, state, country }`, each empty when it isn't shown, the handles normalized.
 */
export default async function readXProfileWithAssistantAsync(
  profile: ContactFromXProfileAiRequest,
): Promise<ContactFromXProfileAiResponse> {
  const { data } = await apiWithAuthentication.post<ContactFromXProfileAiResponse>(
    'ai/contact-from-x-profile',
    profile satisfies ContactFromXProfileAiRequest,
    { timeout: AI_REQUEST_TIMEOUT_MS },
  );
  return data;
}
