import { useEffect, useState, useRef } from 'react';

import CloudSyncContext from './CloudSyncContext';

import useAssets from '@/features/assets-context/useAssets';
import useCloud from '@/features/cloud/useCloud';
import deleteAssetFileAsync from '@/utils/assets/files/deleteAssetFileAsync';
import getAssetsWithSyncError from '@/utils/assets/queries/getAssetsWithSyncError';
import getUnsyncedAssets from '@/utils/assets/queries/getUnsyncedAssets';
import fileSizeToHumanReadable from '@/utils/fileSizeToHumanReadable';

export default function CloudSyncProvider({ children }) {
  const { assets, updateAsset } = useAssets();
  const { isAuthenticated, uploadAssetFileAsync, uploadAssetThumbnailAsync } = useCloud();
  const [unsyncedAssets, setUnsyncedAssets] = useState([]);
  const [assetsWithSyncErrors, setAssetsWithSyncErrors] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncProgressMessage, setSyncProgressMessage] = useState(null);

  // Since state is not updated immediately I use this ref to make sure
  // that the sync function is not running multiple times at the same time.
  const isSyncRunning = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    setUnsyncedAssets(getUnsyncedAssets(assets));
    setAssetsWithSyncErrors(getAssetsWithSyncError(assets));
  }, [assets]);

  function updateSyncProgressMessage({ totalBytesSent, totalBytesExpectedToSend }) {
    const percent = Math.round((totalBytesSent / totalBytesExpectedToSend) * 100);
    const totalBytesExpectedToSendFormatted = fileSizeToHumanReadable(totalBytesExpectedToSend);
    const totalBytesSentFormatted = fileSizeToHumanReadable(totalBytesSent);
    setSyncProgressMessage(
      `Uploading ${totalBytesSentFormatted} of ${totalBytesExpectedToSendFormatted} (${percent}%)`,
    );
  }

  async function syncAssets() {
    // Just making double sure that we don't start syncing multiple times
    if (isSyncRunning.current) return;
    isSyncRunning.current = true;

    setIsSyncing(true);

    for (const [index, asset] of unsyncedAssets.entries()) {
      setSyncMessage(`Syncing ${index + 1} of ${unsyncedAssets.length}`);

      try {
        if (!asset.isFileSynced) {
          await uploadAssetFileAsync(asset, updateSyncProgressMessage);
          setSyncProgressMessage(null);
          await updateAsset(asset.id, { isFileSynced: true });
          // Delete local file. We don't need it anymore since it is now stored in the cloud.
          await deleteAssetFileAsync(asset.filename);
        }

        if (!asset.isThumbnailSynced) {
          await uploadAssetThumbnailAsync(asset);
          await updateAsset(asset.id, { isThumbnailSynced: true });
          // We keep the local thumbnail because it is used in the app.
        }

        await updateAsset(asset.id, { isSynced: true });
      } catch (error) {
        // We do not raise the error and instead continue syncing the other assets.
        // Sync errors are then shown in the UI with a button to retry.
        await updateAsset(asset.id, { syncError: error.message });
      }
    }

    setIsSyncing(false);
    setSyncMessage(null);
    isSyncRunning.current = false;
  }

  const value = {
    unsyncedAssets,
    assetsWithSyncErrors,
    isSyncing,
    syncMessage,
    syncProgressMessage,
    syncNow: syncAssets,
  };

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}
