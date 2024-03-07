import * as FileSystem from 'expo-file-system';

import getAssetFileDownloadUrlAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlAsync';

const CACHE_DIRECTORY = `${FileSystem.cacheDirectory}downloads`;
const PROGRESS_THROTTLE = 250; // ms

export default async function downloadAssetFileAsync(asset, onProgress) {
  const downloadUrl = await getAssetFileDownloadUrlAsync(asset.filename);
  return await downloadWithProgress(asset.filename, downloadUrl, onProgress);
}

async function downloadWithProgress(filename, downloadUrl, onProgress) {
  createCacheDirectoryAsync();
  const fileUri = `${CACHE_DIRECTORY}/${filename}`;

  // We throttle the progress updates because the frequent rerendering slows down the download.
  let lastUpdateTime = 0;

  const throttledProgress = (progress) => {
    const currentTime = Date.now();

    if (currentTime - lastUpdateTime > PROGRESS_THROTTLE) {
      // progress.totalBytesExpectedToWrite
      onProgress(progress.totalBytesWritten);
      lastUpdateTime = currentTime;
    }
  };

  // TODO: Since we are using createDownloadResumable here we could also show a cancel download button.
  const downloadInstance = FileSystem.createDownloadResumable(downloadUrl, fileUri, {}, throttledProgress);
  const result = await downloadInstance.downloadAsync();
  return result.uri;
}

async function createCacheDirectoryAsync() {
  await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });
}
