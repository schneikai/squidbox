import { Alert } from 'react-native';

import useRunWithAssetFiles from '@/utils/assets/files/useRunWithAssetFiles';
import shareFileAsync from '@/utils/files/shareFileAsync';

const FAILURE_TITLE = "Couldn't share";

// Opens the system share sheet for an asset's full-resolution file. Only where canShareFiles.
export default function useShareAsset() {
  const runWithAssetFilesAsync = useRunWithAssetFiles();

  function shareAssetAsync(asset) {
    return runWithAssetFilesAsync(
      [asset],
      (uri) => shareFileAsync(uri, asset.filename, (error) => Alert.alert(FAILURE_TITLE, error.message)),
      { failureTitle: FAILURE_TITLE, keepDownloads: true },
    );
  }

  return shareAssetAsync;
}
