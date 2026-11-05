import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * What the user's vision model reads in a profile screenshot, `image` `{ base64, mimeType }`, as
 * their Contact from screenshot instructions ask: `{ name, xHandle, blueskyHandle, onlyFansHandle,
 * jffHandle, place }`, each empty when it isn't shown, the handles normalized.
 */
export default async function readContactScreenshotAsync(image) {
  const { data } = await apiWithAuthentication.post(
    'ai/contact-from-screenshot',
    { image },
    { timeout: AI_REQUEST_TIMEOUT_MS },
  );
  return data;
}
