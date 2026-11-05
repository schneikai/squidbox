import { File } from 'expo-file-system';

import type { LibraryPaths } from '@/library/libraryPaths';
import getAssetFileDownloadUrlsAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync';

const DOWNLOADS_AT_ONCE = 3; // per batch; the loader runs two

/** Where a kind of file lives on the device: whether one is there, and its uri. */
export type FileLocation = {
  hasAsync: (name: string, library: LibraryPaths) => Promise<boolean>;
  uriOf: (name: string, library: LibraryPaths) => string;
};

/**
 * Downloads the files named `names` not in `library` yet (thumbnails, a file field's files) and
 * resolves the names of those it has afterwards: `hasAsync(name, library)` looks for one on the
 * device, `uriOf(name, library)` is where it goes. Throws when it can't ask for any (the presign
 * request failed). Once `signal` aborts, no new download starts.
 */
export default async function preloadFilesAsync(
  names: readonly string[],
  { hasAsync, uriOf }: FileLocation,
  library: LibraryPaths,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const isOnDevice = await Promise.all(names.map((name) => hasAsync(name, library)));
  const available = new Set(names.filter((_, index) => isOnDevice[index]));
  const missing = names.filter((_, index) => !isOnDevice[index]);
  if (missing.length === 0 || signal?.aborted) return available;

  const pending = await getAssetFileDownloadUrlsAsync(missing);
  async function downloadNext() {
    while (pending.length > 0 && !signal?.aborted) {
      const [name, presignedUrl] = pending.shift()!;
      if (await downloadAsync(presignedUrl, uriOf(name, library))) available.add(name);
    }
  }
  await Promise.all(Array.from({ length: DOWNLOADS_AT_ONCE }, downloadNext));
  return available;
}

// Resolves whether the file landed; never throws, so one bad download leaves the others be. A
// response that isn't a success (a presigned GET that 403s, say) writes no file, so nothing passes
// for the file.
async function downloadAsync(url: string, fileUri: string): Promise<boolean> {
  try {
    await File.downloadFileAsync(url, new File(fileUri), { idempotent: true });
    return true;
  } catch {
    // A network error or a failed response: the loader tries it again.
    return false;
  }
}
