import type { VerifyPhotosResponse } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/** The vision Verify's photos: file name → `data:image/jpeg;base64,…` URL. */
export default async function fetchVerifyPhotosAsync(): Promise<VerifyPhotosResponse['photos']> {
  const { data } = await apiWithAuthentication.get<VerifyPhotosResponse>('ai/verify-photos');
  return data.photos;
}
