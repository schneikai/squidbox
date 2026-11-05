import type { TagPhotoRequest, TagPhotoResponse, VisionImage } from '@squidbox/shared';

import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * The tags the user's vision model sees in one photo, `image` `{ base64, mimeType }`
 * (readVisionImageAsync), as their Photo tags instructions ask; they fit ASSET_TAG_LIMITS.
 */
export default async function tagPhotoAsync(image: VisionImage): Promise<TagPhotoResponse['tags']> {
  const { data } = await apiWithAuthentication.post<TagPhotoResponse>('ai/tags', { image } satisfies TagPhotoRequest, {
    timeout: AI_REQUEST_TIMEOUT_MS,
  });
  return data.tags;
}
