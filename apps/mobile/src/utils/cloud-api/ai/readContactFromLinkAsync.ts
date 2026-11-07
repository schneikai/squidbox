import type { ContactFromLinkRequest, ContactFromLinkResponse } from '@squidbox/shared';

import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

// The model's read, and before it the page and the photo (the server's 12 s budget).
const CONTACT_FROM_LINK_TIMEOUT_MS = AI_REQUEST_TIMEOUT_MS + 20_000;

/**
 * From link: what the server reads in the public X profile of `handle`: its `status`, the contact the
 * user's writing model read in it (the name, handles and place, each empty when it isn't shown) and
 * the photo (`avatar`, base64).
 */
export default async function readContactFromLinkAsync(handle: string): Promise<ContactFromLinkResponse> {
  const { data } = await apiWithAuthentication.post<ContactFromLinkResponse>(
    'ai/contact-from-link',
    { handle } satisfies ContactFromLinkRequest,
    { timeout: CONTACT_FROM_LINK_TIMEOUT_MS },
  );
  return data;
}
