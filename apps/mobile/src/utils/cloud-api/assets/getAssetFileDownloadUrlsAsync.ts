import type { DownloadUrlsRequest, DownloadUrlsResponse } from '@squidbox/shared';

import apiWithAuthentication from '../apiWithAuthentication';

export type DownloadUrlOptions = Pick<DownloadUrlsRequest, 'expiresIn'>;

// Presigned GET URLs for asset files/thumbnails, from the new backend:
//   POST /assets/download-urls  { keys, expiresIn? }  ->  { urls: [{ key, url }] }
// Returns [[key, url], ...] (the shape existing callers destructure).
export default async function getAssetFileDownloadUrlsAsync(
  fileKeys: string[],
  { expiresIn }: DownloadUrlOptions = {},
): Promise<[key: string, url: string][]> {
  const { data } = await apiWithAuthentication.post<DownloadUrlsResponse>('assets/download-urls', {
    keys: fileKeys,
    ...(expiresIn !== undefined && { expiresIn }),
  } satisfies DownloadUrlsRequest);
  return (data?.urls ?? []).map(({ key, url }) => [key, url]);
}
