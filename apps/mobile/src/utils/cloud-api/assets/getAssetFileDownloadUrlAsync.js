import getAssetFileDownloadUrlsAsync from './getAssetFileDownloadUrlsAsync';

export default async function getAssetFileDownloadUrlAsync(fileKey, options) {
  const urlMap = await getAssetFileDownloadUrlsAsync([fileKey], options);
  return urlMap[0][1];
}
