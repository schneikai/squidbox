import * as FileSystem from 'expo-file-system/legacy';

import deleteStaleDownloadsAsync from '@/utils/assets/files/deleteStaleDownloadsAsync';
import getDownloadsDirectory from '@/utils/assets/files/getDownloadsDirectory';

const PROGRESS_THROTTLE = 250; // ms

// Fetches an asset's full-resolution file from `downloadUrl` (getAssetFileSourceAsync's) into
// `library`'s downloads folder and resolves its uri. `onProgress` gets the share done (0–1); aborting
// `signal` cancels the download, which rejects with an `AbortError` (also when it lands as the
// download finishes, so nothing uses a file after a Cancel).
export default async function downloadAssetFileAsync({ filename }, downloadUrl, library, { onProgress, signal }) {
  const cancelled = () => Object.assign(new Error(`Downloading ${filename} was cancelled`), { name: 'AbortError' });
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

    // The expected size is -1 when the response has no Content-Length.
    if (currentTime - lastUpdateTime > PROGRESS_THROTTLE && progress.totalBytesExpectedToWrite > 0) {
      onProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
      lastUpdateTime = currentTime;
    }
  };

  const downloadInstance = FileSystem.createDownloadResumable(downloadUrl, fileUri, {}, throttledProgress);
  // A signal aborted before this point (while the URL or the folder was had, say) fires no event.
  if (signal.aborted) throw cancelled();
  const cancel = () => downloadInstance.cancelAsync().catch((error) => console.warn('Could not cancel', error));
  signal.addEventListener('abort', cancel);
  try {
    const result = await downloadInstance.downloadAsync();
    // A presigned GET that 403/404s does NOT throw: the file holds the S3 error XML. A cancelled
    // download resolves undefined; one cancelled as it finished resolves. A partial file is deleted too.
    if (!result || signal.aborted) throw cancelled();
    if (result.status < 200 || result.status >= 300)
      throw new Error(`Downloading ${filename} failed (HTTP ${result.status})`);
    return result.uri;
  } catch (error) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    // However the native side ends a cancelled download, it's the Cancel.
    throw signal.aborted ? cancelled() : error;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}
