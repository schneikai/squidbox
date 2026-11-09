import type { ContactFromScreenshotRequest, ContactRead, VisionImage } from '@squidbox/shared';

import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * What the user's vision model reads in a profile screenshot, `image` `{ base64, mimeType }`, as
 * their From screenshot instructions ask: `{ name, xHandle, blueskyHandle, onlyFansHandle,
 * jffHandle, city, state, country }`, each empty when it isn't shown, the handles bare, case kept.
 */
export default async function readContactScreenshotAsync(image: VisionImage): Promise<ContactRead> {
  const { data } = await apiWithAuthentication.post<ContactRead>(
    'ai/contact-from-screenshot',
    { image } satisfies ContactFromScreenshotRequest,
    { timeout: AI_REQUEST_TIMEOUT_MS },
  );
  return data;
}
