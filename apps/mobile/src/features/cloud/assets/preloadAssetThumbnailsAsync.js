import * as FileSystem from 'expo-file-system/legacy';

import { getLibrary } from '@/library/current';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
import hasThumbnailAsync from '@/utils/assets/thumbnails/hasThumbnailAsync';
import getAssetFileDownloadUrlsAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync';

export default async function preloadAssetThumbnailsAsync(assets) {
  const batchSize = 25;
  const batch = [];

  // The downloads land in the library open now, however long the network takes.
  const library = getLibrary();

  for (const asset of assets) {
    if (await hasThumbnailAsync(asset.thumbnailFilename, library)) continue;
    batch.push(asset);

    if (batch.length >= batchSize) {
      await preloadBatch(batch, library);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    await preloadBatch(batch, library);
  }
}

async function preloadBatch(assets, library) {
  const thumbnailFilenames = assets.map((asset) => asset.thumbnailFilename);

  const presignedUrls = await getAssetFileDownloadUrlsAsync(thumbnailFilenames);

  for (const [thumbnailFilename, presignedUrl] of presignedUrls) {
    const fileUri = getAssetThumbnailUri(thumbnailFilename, library);
    const { status } = await FileSystem.downloadAsync(presignedUrl, fileUri);
    // A presigned GET that 403/404s does NOT throw — downloadAsync writes the S3 error XML to the
    // file and returns non-200. That poisons the cache: hasThumbnailAsync then sees a file and
    // reports the thumbnail "present", so the grid shows a broken image forever with no retry.
    // Delete the bad file and throw so the caller can surface the error and the cell can retry.
    if (status !== 200) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      throw new Error(`Thumbnail download failed (HTTP ${status}) for ${thumbnailFilename}`);
    }
  }
}
