import type { ContactFromXProfileRequest, ContactFromXProfileResponse } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

// Above the server's budget for the whole read (12 s: the page, Bluesky and the photo), so the app
// gets its answer rather than giving up first.
const X_PROFILE_TIMEOUT_MS = 20_000;

/**
 * What the server reads from the public X profile of `handle` for From link: its `status`, the name,
 * the handles, the location (as the city), the bio, the website and the photo (`avatar`, base64),
 * each empty when the profile doesn't show it. Without the assistant: readXProfileWithAssistantAsync
 * is its pass.
 */
export default async function readXProfileAsync(handle: string): Promise<ContactFromXProfileResponse> {
  const { data } = await apiWithAuthentication.post<ContactFromXProfileResponse>(
    'contacts/x-profile',
    { handle } satisfies ContactFromXProfileRequest,
    { timeout: X_PROFILE_TIMEOUT_MS },
  );
  return data;
}
