import apiWithAuthentication from '../apiWithAuthentication';

export default async function getAssetFileDownloadUrlsAsync(fileKeys) {
  const { data } = await apiWithAuthentication.post('asset_files/download_urls', {
    fileKeys,
  });
  return data;
}
