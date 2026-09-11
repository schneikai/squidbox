import getAssetFileDownloadUrlsAsync from './getAssetFileDownloadUrlsAsync';

export default async function getAssetFileDownloadUrlAsync(fileKey, options) {
  const urls = await getAssetFileDownloadUrlsAsync([fileKey], options);
  const found = urls.find(([key]) => key === fileKey);
  return found?.[1] ?? null;
}
