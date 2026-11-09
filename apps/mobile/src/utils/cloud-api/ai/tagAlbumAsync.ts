import type { TagAlbumRequest, TagPhotoResponse, VisionImage } from '@squidbox/shared';

import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * The tags the user's vision model finds fit all of an album's photos, from a few of them in one
 * request (`images`, readVisionImageAsync's, up to ALBUM_TAG_PHOTOS), as their Album tags
 * instructions ask; they fit ASSET_TAG_LIMITS. `signal` stops it.
 */
export default async function tagAlbumAsync(
  images: VisionImage[],
  signal?: AbortSignal,
): Promise<TagPhotoResponse['tags']> {
  const { data } = await apiWithAuthentication.post<TagPhotoResponse>(
    'ai/album-tags',
    { images } satisfies TagAlbumRequest,
    { timeout: AI_REQUEST_TIMEOUT_MS, signal },
  );
  return data.tags;
}
