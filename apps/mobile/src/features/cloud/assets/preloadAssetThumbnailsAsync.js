import { File } from 'expo-file-system';

import { getAssetThumbnailUri, hasThumbnailAsync } from '@/utils/assets/assetStorage';
import getAssetFileDownloadUrlsAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync';

const DOWNLOADS_AT_ONCE = 3; // per batch; the loader runs two

// Downloads the thumbnails of `assets` not in `library` yet and resolves the names of those it has
// afterwards. Throws when it can't ask for any (the presign request failed). Once `signal` aborts, no
// new download starts.
export default async function preloadAssetThumbnailsAsync(assets, library, signal) {
  const names = assets.map((asset) => asset.thumbnailFilename);
  const isOnDevice = await Promise.all(names.map((name) => hasThumbnailAsync(name, library)));
  const available = new Set(names.filter((_, index) => isOnDevice[index]));
  const missing = names.filter((_, index) => !isOnDevice[index]);
  if (missing.length === 0 || signal?.aborted) return available;

  const pending = await getAssetFileDownloadUrlsAsync(missing);
  async function downloadNext() {
    while (pending.length > 0 && !signal?.aborted) {
      const [thumbnailFilename, presignedUrl] = pending.shift();
      if (await downloadAsync(presignedUrl, getAssetThumbnailUri(thumbnailFilename, library))) {
        available.add(thumbnailFilename);
      }
    }
  }
  await Promise.all(Array.from({ length: DOWNLOADS_AT_ONCE }, downloadNext));
  return available;
}

// Resolves whether the file landed; never throws, so one bad download leaves the others be. A
// response that isn't a success (a presigned GET that 403s, say) writes no file, so nothing passes
// for the thumbnail.
async function downloadAsync(url, fileUri) {
  try {
    await File.downloadFileAsync(url, new File(fileUri), { idempotent: true });
    return true;
  } catch {
    // A network error or a failed response: the loader tries it again.
    return false;
  }
}
