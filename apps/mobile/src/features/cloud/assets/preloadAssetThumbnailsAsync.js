import * as FileSystem from 'expo-file-system/legacy';

import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
import hasThumbnailAsync from '@/utils/assets/thumbnails/hasThumbnailAsync';
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

// Resolves whether the file landed; never throws, so one bad download leaves the others be.
async function downloadAsync(url, fileUri) {
  try {
    const { status } = await FileSystem.downloadAsync(url, fileUri);
    if (status === 200) return true;
  } catch {
    // A network error: the loader tries it again.
  }
  // A presigned GET that 403/404s does NOT throw — downloadAsync writes the S3 error XML to the file
  // and returns non-200. Left there, it would pass for the thumbnail and show as a broken image.
  await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
  return false;
}
