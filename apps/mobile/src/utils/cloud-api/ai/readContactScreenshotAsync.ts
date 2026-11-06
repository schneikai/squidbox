import type { ContactFromScreenshotRequest, ContactFromScreenshotResponse, VisionImage } from '@squidbox/shared';

import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * What the user's vision model reads in a profile screenshot, `image` `{ base64, mimeType }`, as
 * their From screenshot instructions ask: `{ name, xHandle, blueskyHandle, onlyFansHandle,
 * jffHandle, city, state, country }`, each empty when it isn't shown, the handles normalized.
 */
export default async function readContactScreenshotAsync(image: VisionImage): Promise<ContactFromScreenshotResponse> {
  const { data } = await apiWithAuthentication.post<ContactFromScreenshotResponse>(
    'ai/contact-from-screenshot',
    { image } satisfies ContactFromScreenshotRequest,
    { timeout: AI_REQUEST_TIMEOUT_MS },
  );
  return data;
}
