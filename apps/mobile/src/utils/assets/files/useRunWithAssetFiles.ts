import { Alert } from 'react-native';

import assetFileUnavailableMessages from './assetFileUnavailableMessages';
import deleteStaleDownloadsAsync from './deleteStaleDownloadsAsync';
import getAssetFileStatusAsync, { type AssetFileAsset, type AssetFileLocation } from './getAssetFileStatusAsync';
import isUnavailableStatus from './isUnavailableStatus';
import withAssetFileAsync from './withAssetFileAsync';

import useRunWithProgress, { type RunWithProgressOptions } from '@/components/progress-overlay/useRunWithProgress';
import useOpenLibrary from '@/library/useOpenLibrary';
import useCloud from '@/providers/cloud/useCloud';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// One run at a time, app-wide: one progress ring, and a tap while it's up is ignored.
let isRunning = false;

type RunWithAssetFilesOptions = RunWithProgressOptions & { failureTitle: string };

/**
 * Runs `run(uri, asset)` over assets' full-resolution files (see withAssetFileAsync), one by one,
 * through useRunWithProgress (with its options): the ring follows the downloads, Cancel stops the
 * running one, and a failure says how many went through unless `countsDone: false`. Alerts why when one can't be had (checked up front, without
 * asking the cloud for URLs, so a batch doesn't stop halfway). A tap while a run is going is ignored.
 *
 * `run` may read the file after it returns: downloads are kept, and reused, for a day after their
 * last use (deleteStaleDownloadsAsync, at the start of each run, removes them after). Resolves to
 * whether every asset went through.
 */
export default function useRunWithAssetFiles() {
  const { isAuthenticated } = useCloud();
  const runWithProgress = useRunWithProgress();
  const { paths: library } = useOpenLibrary();

  return async function runWithAssetFilesAsync<A extends AssetFileAsset>(
    assets: readonly A[],
    run: (uri: string, asset: A) => Promise<unknown> | unknown,
    { failureTitle, countsDone }: RunWithAssetFilesOptions,
  ): Promise<boolean> {
    if (isRunning) return false;
    isRunning = true;

    try {
      if (await alertIfUnavailableAsync(assets, { isAuthenticated, library })) return false;

      return await runWithProgress(
        async ({ onProgress, signal }) => {
          await deleteStaleDownloadsAsync(library);
          for (const [index, asset] of assets.entries()) {
            if (signal.aborted) return false;
            const onFileProgress = (fraction: number) => onProgress(index, assets.length, fraction);
            const options = { isAuthenticated, library, onProgress: onFileProgress, signal };
            await withAssetFileAsync(asset, options, (uri) => run(uri, asset));
            onProgress(index + 1, assets.length);
          }
        },
        { failureTitle, countsDone },
      );
    } catch (error) {
      // The up-front checks: runWithProgress alerts what fails after them.
      Alert.alert(failureTitle, apiErrorMessage(error));
      return false;
    } finally {
      isRunning = false;
    }
  };
}

async function alertIfUnavailableAsync(
  assets: readonly AssetFileAsset[],
  options: AssetFileLocation,
): Promise<boolean> {
  for (const asset of assets) {
    const status = await getAssetFileStatusAsync(asset, options);
    const unavailable = isUnavailableStatus(status) ? assetFileUnavailableMessages[status] : null;
    if (unavailable) {
      Alert.alert(unavailable.title, unavailable.message);
      return true;
    }
  }
  return false;
}
