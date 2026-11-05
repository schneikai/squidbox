import type { AssetRecord } from '@squidbox/shared';
import { Alert } from 'react-native';

import assetFileUnavailableMessages from './assetFileUnavailableMessages';
import deleteStaleDownloadsAsync from './deleteStaleDownloadsAsync';
import getAssetFileStatusAsync, { type AssetFileLocation } from './getAssetFileStatusAsync';
import withAssetFileAsync from './withAssetFileAsync';

import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import useCloud from '@/features/cloud/useCloud';
import useLibrary from '@/library/useLibrary';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// One run at a time, app-wide: one progress ring, and a tap while it's up is ignored.
let isRunning = false;

type RunAsset = Pick<AssetRecord, 'filename' | 'isFileSynced'>;

type RunWithAssetFilesOptions = {
  failureTitle: string;
  prepareAsync?: () => Promise<boolean>;
  keepDownloads?: boolean;
};

/**
 * Runs `use(uri, asset)` over assets' full-resolution files (see withAssetFileAsync), one by one,
 * through useRunWithProgress: the ring follows the downloads, Cancel stops the running one, and a
 * failure says how many went through. Alerts why when one can't be had (checked up front, without
 * asking the cloud for URLs, so a batch doesn't stop halfway). A tap while a run is going is ignored.
 *
 * Options: `failureTitle`; `prepareAsync`, which may resolve false to stop before anything starts;
 * `keepDownloads` for a `use` that reads the file after it returns (deleteStaleDownloadsAsync, at
 * the start of each run, removes them once over an hour old). Resolves to whether every asset went
 * through.
 */
export default function useRunWithAssetFiles() {
  const { isAuthenticated } = useCloud();
  const runWithProgress = useRunWithProgress();
  const { paths: library } = useLibrary();

  return async function runWithAssetFilesAsync<A extends RunAsset>(
    assets: readonly A[],
    use: (uri: string, asset: A) => Promise<unknown> | unknown,
    { failureTitle, prepareAsync, keepDownloads = false }: RunWithAssetFilesOptions,
  ): Promise<boolean> {
    if (isRunning) return false;
    // Below LibraryGate, a library is always open.
    const openLibrary = library!;
    isRunning = true;

    try {
      if (await alertIfUnavailableAsync(assets, { isAuthenticated, library: openLibrary })) return false;
      if (prepareAsync && !(await prepareAsync())) return false;

      return await runWithProgress(
        async ({ onProgress, signal }) => {
          await deleteStaleDownloadsAsync(openLibrary);
          for (const [index, asset] of assets.entries()) {
            if (signal.aborted) return false;
            const onFileProgress = (fraction: number) => onProgress(index, assets.length, fraction);
            const options = {
              isAuthenticated,
              library: openLibrary,
              onProgress: onFileProgress,
              signal,
              keepDownloads,
            };
            await withAssetFileAsync(asset, options, (uri) => use(uri, asset));
            onProgress(index + 1, assets.length);
          }
        },
        { failureTitle },
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

async function alertIfUnavailableAsync(assets: readonly RunAsset[], options: AssetFileLocation): Promise<boolean> {
  for (const asset of assets) {
    const status = await getAssetFileStatusAsync(asset, options);
    const unavailable =
      status === 'notUploaded' || status === 'signedOut' ? assetFileUnavailableMessages[status] : null;
    if (unavailable) {
      Alert.alert(unavailable.title, unavailable.message);
      return true;
    }
  }
  return false;
}
