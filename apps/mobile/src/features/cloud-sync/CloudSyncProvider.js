import { useState, useRef, useMemo } from 'react';

import CloudSyncContext from './CloudSyncContext';

import useAssets from '@/features/assets-context/useAssets';
import useCloud from '@/features/cloud/useCloud';
import { countSyncErrors, countUnsynced, readUnsynced } from '@/sync/assetsRepository';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';
import deleteAssetFileAsync from '@/utils/assets/files/deleteAssetFileAsync';
import fileSizeToHumanReadable from '@/utils/fileSizeToHumanReadable';

const UPLOAD_BATCH = 50;
const NO_COUNTS = { unsyncedCount: 0, syncErrorCount: 0 };

function readBackupCounts(db) {
  return db.transaction(async (tx) => ({
    unsyncedCount: await countUnsynced(tx),
    syncErrorCount: await countSyncErrors(tx),
  }));
}

export default function CloudSyncProvider({ children }) {
  const { updateAsset, setAssetsSyncError } = useAssets();
  const { isAuthenticated, uploadAssetFileAsync, uploadAssetThumbnailAsync } = useCloud();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncProgressMessage, setSyncProgressMessage] = useState(null);
  const [syncSpeedMessage, setSyncSpeedMessage] = useState(null);
  const [backupError, setBackupError] = useState(null);

  // Live counts (0 while signed out: backup needs the cloud), each covered by a partial index.
  const { unsyncedCount, syncErrorCount } =
    useLiveQuery(
      async (db) => (isAuthenticated ? readBackupCounts(db) : NO_COUNTS),
      [schema.assets],
      [isAuthenticated],
    ) ?? NO_COUNTS;

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
    // Backup needs the cloud. Just making double sure that we don't start syncing multiple times.
    if (!isAuthenticated || isSyncRunning.current) return;
    isSyncRunning.current = true;

    setIsSyncing(true);
    sessionStartRef.current = Date.now();
    completedBytesRef.current = 0;
    setBackupError(null);

    // The total is fixed at the start (the live count shrinks as uploads land) and the walk by id
    // stops after that many, so each asset is tried once however the run marks it and the progress
    // never passes its total; anything added meanwhile waits for the next run.
    try {
      const db = getDb();
      const total = await countUnsynced(db);
      let index = 0;
      let afterId = null;
      while (index < total) {
        const batch = await readUnsynced(db, { afterId, limit: Math.min(UPLOAD_BATCH, total - index) });
        if (batch.length === 0) break;
        afterId = batch[batch.length - 1].id;
        for (const asset of batch) await uploadAsset(asset, ++index, total);
      }
    } catch (error) {
      // Not an upload (those are marked per asset): the run itself couldn't go on.
      console.error('Backup failed', error);
      setBackupError(error.message);
    } finally {
      setIsSyncing(false);
      setSyncMessage(null);
      isSyncRunning.current = false;
    }
  }

  async function uploadAsset(asset, index, total) {
    setSyncMessage(`Syncing ${index} of ${total}`);
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

      // We keep the local thumbnail because it is used in the app.
      if (!asset.isThumbnailSynced) await uploadAssetThumbnailAsync(asset);
      await updateAsset(asset.id, { isThumbnailSynced: true, isSynced: true });
    } catch (error) {
      // We do not raise the error and instead continue syncing the other assets.
      // Sync errors are then shown in the UI with a button to retry.
      await setAssetsSyncError([asset.id], error.message);
    }
  }

  const value = useMemo(
    () => ({
      unsyncedCount,
      syncErrorCount,
      backupError,
      isSyncing,
      syncMessage,
      syncProgressMessage,
      syncSpeedMessage,
      syncNow: syncAssets,
    }),
    [
      isAuthenticated,
      unsyncedCount,
      syncErrorCount,
      backupError,
      isSyncing,
      syncMessage,
      syncProgressMessage,
      syncSpeedMessage,
    ],
  );

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}
