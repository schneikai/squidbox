import * as FileSystem from 'expo-file-system/legacy';

import getDownloadsDirectory from '@/utils/assets/files/getDownloadsDirectory';

const PROGRESS_THROTTLE = 250; // ms

// Fetches an asset's full-resolution file from `downloadUrl` (getAssetFileSourceAsync's) into
// `library`'s downloads folder and resolves its uri.
export default async function downloadAssetFileAsync(asset, downloadUrl, library, onProgress) {
  return await downloadWithProgress(asset.filename, downloadUrl, library, onProgress);
}

async function downloadWithProgress(filename, downloadUrl, library, onProgress) {
  // Must finish before the download starts — createDownloadResumable does NOT create parent dirs, so
  // on a fresh install / cleared cache the first download would reject before any progress fires.
  const directory = getDownloadsDirectory(library);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const fileUri = `${directory}${filename}`;

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
