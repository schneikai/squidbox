import getAssetFileDownloadUrlsAsync from './getAssetFileDownloadUrlsAsync';

export default async function getAssetFileDownloadUrlAsync(fileKey) {
  const urlMap = await getAssetFileDownloadUrlsAsync([fileKey]);
  return urlMap[0][1];
}
