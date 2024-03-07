import * as FileSystem from 'expo-file-system';

import createAssetThumbnailDirectory from '@/utils/assets/thumbnails/createAssetThumbnailDirectory';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
import hasThumbnailAsync from '@/utils/assets/thumbnails/hasThumbnailAsync';
import getAssetFileDownloadUrlsAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync';

export default async function preloadAssetThumbnailsAsync(assets) {
  const batchSize = 25;
  const batch = [];

  await createAssetThumbnailDirectory();

  for (const asset of assets) {
    if (await hasThumbnailAsync(asset.thumbnailFilename)) continue;
    batch.push(asset);

    if (batch.length >= batchSize) {
      await preloadBatch(batch);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    await preloadBatch(batch);
  }
}

async function preloadBatch(assets) {
  const thumbnailFilenames = assets.map((asset) => asset.thumbnailFilename);

  try {
    const presignedUrls = await getAssetFileDownloadUrlsAsync(thumbnailFilenames);

    for (const [thumbnailFilename, presignedUrl] of presignedUrls) {
      const fileUri = getAssetThumbnailUri(thumbnailFilename);
      await FileSystem.downloadAsync(presignedUrl, fileUri);
    }
  } catch (e) {
    // TODO: Error handling like this is useless for debugging since it
    // is missing the stack trace.
    console.log(`Failed to load asset thumbnails! Error: ${e.message}`);
  }
}
