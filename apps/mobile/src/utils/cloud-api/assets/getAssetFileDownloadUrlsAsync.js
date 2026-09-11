import apiWithAuthentication from '../apiWithAuthentication';

// Presigned GET URLs for asset files/thumbnails, from the new backend:
//   POST /assets/download-urls  { keys, expiresIn? }  ->  { urls: [{ key, url }] }
// Returns [[key, url], ...] (the shape existing callers destructure).
export default async function getAssetFileDownloadUrlsAsync(fileKeys, { expiresIn } = {}) {
  const { data } = await apiWithAuthentication.post('assets/download-urls', {
    keys: fileKeys,
    ...(expiresIn !== undefined && { expiresIn }),
  });
  return (data?.urls ?? []).map(({ key, url }) => [key, url]);
}
