import { Alert } from 'react-native';

import assetFileUnavailableMessages from './assetFileUnavailableMessages';
import deleteStaleDownloadsAsync from './deleteStaleDownloadsAsync';
import getAssetFileStatusAsync from './getAssetFileStatusAsync';
import withAssetFileAsync from './withAssetFileAsync';

import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import useCloud from '@/features/cloud/useCloud';
import { getLibrary } from '@/library/current';

// One run at a time, app-wide, so two never write the same download.
let isRunning = false;

/**
 * Runs `use(uri, asset)` over assets' full-resolution files (see withAssetFileAsync), one by one,
 * through useRunWithProgress: the ring follows the downloads, Cancel stops the running one, and a
 * failure says how many went through. Alerts why when one can't be had (checked up front, without
 * asking the cloud for URLs, so a batch doesn't stop halfway). A tap while a run is going is ignored.
 *
 * Options: `failureTitle`; `prepareAsync`, which may resolve false to stop before anything starts;
 * `keepDownloads` for a `use` that reads the file after it returns (deleteStaleDownloadsAsync, at
 * the start of each run, removes them once over an hour old).
 */
export default function useRunWithAssetFiles() {
  const { isAuthenticated } = useCloud();
  const runWithProgress = useRunWithProgress();

  return async function runWithAssetFilesAsync(assets, use, { failureTitle, prepareAsync, keepDownloads = false }) {
    if (isRunning) return;
    isRunning = true;
    // The local copies are read from the library open now, however long the downloads take.
    const library = getLibrary();

    try {
      if (await alertIfUnavailableAsync(assets, { isAuthenticated, library })) return;
      if (prepareAsync && !(await prepareAsync())) return;

      await runWithProgress(
        async ({ onProgress, signal }) => {
          await deleteStaleDownloadsAsync(library);
          for (const [index, asset] of assets.entries()) {
            if (signal.aborted) return false;
            const onFileProgress = (fraction) => onProgress(index, assets.length, fraction);
            const options = { isAuthenticated, library, onProgress: onFileProgress, signal, keepDownloads };
            await withAssetFileAsync(asset, options, (uri) => use(uri, asset));
            onProgress(index + 1, assets.length);
          }
        },
        { failureTitle },
      );
    } catch (error) {
      // The up-front checks: runWithProgress alerts what fails after them.
      Alert.alert(failureTitle, error.message);
    } finally {
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
