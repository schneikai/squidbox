import getAssetFileDownloadUrlsAsync, { type DownloadUrlOptions } from './getAssetFileDownloadUrlsAsync';

export default async function getAssetFileDownloadUrlAsync(
  fileKey: string,
  options?: DownloadUrlOptions,
): Promise<string | null> {
  const urls = await getAssetFileDownloadUrlsAsync([fileKey], options);
  const found = urls.find(([key]) => key === fileKey);
  return found?.[1] ?? null;
}
