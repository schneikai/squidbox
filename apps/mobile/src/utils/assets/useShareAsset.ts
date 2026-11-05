import type { AssetRecord } from '@squidbox/shared';
import { Alert } from 'react-native';

import useRunWithAssetFiles from '@/utils/assets/files/useRunWithAssetFiles';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import shareFileAsync from '@/utils/files/shareFileAsync';

const FAILURE_TITLE = "Couldn't share";

// Opens the system share sheet for an asset's full-resolution file. Only where canShareFiles.
export default function useShareAsset() {
  const runWithAssetFilesAsync = useRunWithAssetFiles();

  function shareAssetAsync(asset: Pick<AssetRecord, 'filename' | 'isFileSynced'>) {
    return runWithAssetFilesAsync(
      [asset],
      (uri) => shareFileAsync(uri, asset.filename, (error) => Alert.alert(FAILURE_TITLE, apiErrorMessage(error))),
      { failureTitle: FAILURE_TITLE, keepDownloads: true },
    );
  }

  return shareAssetAsync;
}
