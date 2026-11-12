import { Alert } from 'react-native';

import type { AssetFileAsset } from '@/utils/assets/files/getAssetFileStatusAsync';
import useRunWithAssetFiles from '@/utils/assets/files/useRunWithAssetFiles';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import shareFilesAsync, { type ShareFile } from '@/utils/files/shareFilesAsync';

const FAILURE_TITLE = "Couldn't share";

// Opens the system share sheet with assets' full-resolution files, all at once, after every one is
// at hand (the progress ring follows the downloads; Cancel opens nothing), or says there is nothing
// to share. Only where canShareFiles.
export default function useShareAssets() {
  const runWithAssetFilesAsync = useRunWithAssetFiles();

  async function shareAssetsAsync(assets: readonly AssetFileAsset[]): Promise<void> {
    // The same asset twice (a thread reusing a photo) is shared once. `filename` is the file's
    // storage name and the only key an AssetFileAsset has.
    const unique = [...new Map(assets.map((asset) => [asset.filename, asset])).values()];
    if (unique.length === 0) {
      Alert.alert('Nothing to share', 'There are no photos or videos to share.');
      return;
    }

    const files: ShareFile[] = [];
    const isReady = await runWithAssetFilesAsync(
      unique,
      (uri, asset) => files.push({ uri, filename: asset.filename }),
      // Nothing is shared before the sheet opens: a failure shows only its error, a Cancel nothing.
      { failureTitle: FAILURE_TITLE, countsDone: false },
    );
    if (!isReady) return;

    try {
      await shareFilesAsync(files);
    } catch (error) {
      Alert.alert(FAILURE_TITLE, apiErrorMessage(error));
    }
  }

  return shareAssetsAsync;
}
