import type { ContactFromXProfileRequest, ContactFromXProfileResponse } from '@squidbox/shared';

import { AI_REQUEST_TIMEOUT_MS } from '@/utils/cloud-api/ai/aiRequestTimeout';
import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * What the server reads from the public X profile of `handle` for From link: its `status`, the name,
 * the handles, the place, the bio, the website and the photo (`avatar`, base64), each empty when the
 * profile doesn't show it. As long as an assistant's answer may take: the server asks the writing
 * model for an account with the `ai` feature.
 */
export default async function readXProfileAsync(handle: string): Promise<ContactFromXProfileResponse> {
  const { data } = await apiWithAuthentication.post<ContactFromXProfileResponse>(
    'contacts/x-profile',
    { handle } satisfies ContactFromXProfileRequest,
    { timeout: AI_REQUEST_TIMEOUT_MS },
  );
  return data;
}
