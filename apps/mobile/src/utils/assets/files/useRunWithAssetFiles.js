import { Alert } from 'react-native';

import assetFileUnavailableMessages from './assetFileUnavailableMessages';
import getAssetFileStatusAsync from './getAssetFileStatusAsync';
import withAssetFileAsync from './withAssetFileAsync';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useCloud from '@/features/cloud/useCloud';
import { getLibrary } from '@/library/current';

// One run at a time, app-wide, so two never write the same download.
let isRunning = false;

/**
 * Runs `use(uri, asset)` over assets' full-resolution files (see withAssetFileAsync), one by one,
 * behind the progress overlay. Alerts why when one can't be had (checked up front, without asking
 * the cloud for URLs, so a batch doesn't stop halfway), and alerts a failure with how many went
 * through. A tap while a run is going is ignored.
 *
 * Options: `failureTitle`; `prepareAsync`, which may resolve false to stop before anything starts;
 * `keepDownloads` for a `use` that reads the file after it returns (deleteStaleDownloadsAsync
 * removes those later).
 */
export default function useRunWithAssetFiles() {
  const { isAuthenticated } = useCloud();
  const { show, hide, updateProgress } = useProgressOverlay();

  return async function runWithAssetFilesAsync(assets, use, { failureTitle, prepareAsync, keepDownloads = false }) {
    if (isRunning) return;
    isRunning = true;
    // The local copies are read from the library open now, however long the downloads take.
    const library = getLibrary();
    let doneCount = 0;

    try {
      if (await alertIfUnavailableAsync(assets, { isAuthenticated, library })) return;
      if (prepareAsync && !(await prepareAsync())) return;

      show();
      const totalBytes = assets.reduce((total, asset) => total + asset.fileSize, 0);
      let doneBytes = 0;
      for (const asset of assets) {
        const onProgress = (bytes) => updateProgress(((doneBytes + bytes) / totalBytes) * 100);
        const options = { isAuthenticated, library, onProgress, keepDownload: keepDownloads };
        await withAssetFileAsync(asset, options, (uri) => use(uri, asset));
        doneBytes += asset.fileSize;
        doneCount += 1;
      }
    } catch (error) {
      Alert.alert(failureTitle, failureMessage(error, doneCount, assets.length));
    } finally {
      hide();
      isRunning = false;
    }
  };
}

async function alertIfUnavailableAsync(assets, options) {
  for (const asset of assets) {
    const unavailable = assetFileUnavailableMessages[await getAssetFileStatusAsync(asset, options)];
    if (unavailable) {
      Alert.alert(unavailable.title, unavailable.message);
      return true;
    }
  }
  return false;
}

function failureMessage(error, doneCount, total) {
  if (doneCount === 0) return error.message;
  return `${error.message}\n\n${doneCount} of ${total} were done before that.`;
}
