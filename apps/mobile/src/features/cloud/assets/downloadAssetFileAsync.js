import * as FileSystem from 'expo-file-system/legacy';

import deleteStaleDownloadsAsync from '@/utils/assets/files/deleteStaleDownloadsAsync';
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
  await deleteStaleDownloadsAsync(library);
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
  try {
    const result = await downloadInstance.downloadAsync();
    // A presigned GET that 403/404s does NOT throw: the file holds the S3 error XML. A cancelled
    // download resolves undefined. A partial file is deleted too.
    if (!result) throw new Error(`Downloading ${filename} was cancelled`);
    if (result.status < 200 || result.status >= 300)
      throw new Error(`Downloading ${filename} failed (HTTP ${result.status})`);
    return result.uri;
  } catch (error) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    throw error;
  }
}
