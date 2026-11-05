import type { FileLocation } from './preloadFilesAsync';

import type { LibraryPaths } from '@/library/libraryPaths';
import webFileUrls from '@/utils/assets/webFileUrls';
import getAssetFileDownloadUrlsAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync';

// Like the native one, with presigned URLs in place of files: resolves the names it has afterwards.
// Nothing is written once `signal` aborts (closing the library cleared webFileUrls).
export default async function preloadFilesAsync(
  names: readonly string[],
  _where: FileLocation,
  _library: LibraryPaths,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const missing = names.filter((name) => !webFileUrls.has(name));
  if (missing.length > 0) {
    const urls = await getAssetFileDownloadUrlsAsync(missing);
    if (signal?.aborted) return new Set<string>();
    for (const [name, url] of urls) webFileUrls.set(name, url);
  }
  return new Set(names.filter((name) => webFileUrls.has(name)));
}
