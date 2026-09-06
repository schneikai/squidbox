import apiWithAuthentication from '../apiWithAuthentication';

export default async function getAssetFileDownloadUrlsAsync(fileKeys, { expiresIn } = {}) {
  const { data } = await apiWithAuthentication.post('asset_files/download_urls', {
    fileKeys,
    ...(expiresIn !== undefined && { expires_in: expiresIn }),
  });
  return data;
}
