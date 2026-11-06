import getAssetFileDownloadUrlsAsync, { type DownloadUrlOptions } from './getAssetFileDownloadUrlsAsync';

export default async function getAssetFileDownloadUrlAsync(
  fileKey: string,
  options?: DownloadUrlOptions,
): Promise<string> {
  const urls = await getAssetFileDownloadUrlsAsync([fileKey], options);
  const url = urls.find(([key]) => key === fileKey)?.[1];
  if (!url) throw new Error(`No download URL for ${fileKey}`);
  return url;
}
