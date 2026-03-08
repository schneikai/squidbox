import { useState, useRef, useMemo } from 'react';

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncProgressMessage, setSyncProgressMessage] = useState(null);
  const [syncSpeedMessage, setSyncSpeedMessage] = useState(null);

  const unsyncedAssets = useMemo(
    () => (isAuthenticated ? getUnsyncedAssets(assets) : []),
    [assets, isAuthenticated],
  );

  const assetsWithSyncErrors = useMemo(
    () => (isAuthenticated ? getAssetsWithSyncError(assets) : []),
    [assets, isAuthenticated],
  );

  // Since state is not updated immediately I use this ref to make sure
  // that the sync function is not running multiple times at the same time.
  const isSyncRunning = useRef(false);
  const lastProgressRef = useRef(null);
  const emaSpeedRef = useRef(0);
  const sessionStartRef = useRef(null);
  const completedBytesRef = useRef(0);

  // Exponential moving average time constant (seconds).
  // Higher = smoother but slower to react. 10s gives a stable readable number.
  const EMA_TAU = 10;

  function updateSyncProgressMessage({ totalBytesSent, totalBytesExpectedToSend }) {
    const now = Date.now();

    if (lastProgressRef.current) {
      const elapsedSeconds = (now - lastProgressRef.current.time) / 1000;
      const bytesDelta = totalBytesSent - lastProgressRef.current.bytes;
      if (elapsedSeconds > 0 && bytesDelta >= 0) {
        const instantSpeed = bytesDelta / elapsedSeconds;
        // Exponential moving average — weights recent samples more heavily
        // while smoothing over ~EMA_TAU seconds to avoid a flickery display.
        const alpha = 1 - Math.exp(-elapsedSeconds / EMA_TAU);
        emaSpeedRef.current = alpha * instantSpeed + (1 - alpha) * emaSpeedRef.current;
      }
    }

    lastProgressRef.current = { bytes: totalBytesSent, time: now };

    const sessionElapsed = (now - sessionStartRef.current) / 1000;
    const sessionTotalBytes = completedBytesRef.current + totalBytesSent;
    const sessionAvgSpeed = sessionElapsed > 0 ? sessionTotalBytes / sessionElapsed : 0;

    setSyncSpeedMessage({
      now: `${fileSizeToHumanReadable(emaSpeedRef.current)}/s`,
      avg: `${fileSizeToHumanReadable(sessionAvgSpeed)}/s`,
    });

    const uploadPercent = Math.round((totalBytesSent / totalBytesExpectedToSend) * 100);
    setSyncProgressMessage({
      sent: fileSizeToHumanReadable(totalBytesSent),
      total: fileSizeToHumanReadable(totalBytesExpectedToSend),
      percent: `${uploadPercent}%`,
    });
  }

  async function syncAssets() {
    // Just making double sure that we don't start syncing multiple times
    if (isSyncRunning.current) return;
    isSyncRunning.current = true;

    setIsSyncing(true);
    sessionStartRef.current = Date.now();
    completedBytesRef.current = 0;

    for (const [index, asset] of unsyncedAssets.entries()) {
      setSyncMessage(`Syncing ${index + 1} of ${unsyncedAssets.length}`);

      try {
        if (!asset.isFileSynced) {
          lastProgressRef.current = null;
          emaSpeedRef.current = 0;
          let fileTotalBytes = 0;
          await uploadAssetFileAsync(asset, (progress) => {
            fileTotalBytes = progress.totalBytesExpectedToSend;
            updateSyncProgressMessage(progress);
          });
          completedBytesRef.current += fileTotalBytes;
          setSyncProgressMessage(null);
          setSyncSpeedMessage(null);
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
    syncSpeedMessage,
    syncNow: syncAssets,
  };

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}
