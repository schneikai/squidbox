import { useState, useRef, useMemo } from 'react';

import CloudSyncContext from './CloudSyncContext';

import uploadFileAsync from '@/features/cloud/assets/uploadFileAsync';
import useCloud from '@/features/cloud/useCloud';
import { currentSyncIdentity } from '@/library/currentSyncIdentity';
import { removeAssetFiles } from '@/library/fs';
import useLibrary from '@/library/useLibrary';
import { isBackupRunning, runBackup } from '@/sync/backupRun';
import { getDb } from '@/sync/db/client';
import { getAssetFileUri, getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import ensureAssetThumbnailAsync from '@/utils/assets/thumbnails/ensureAssetThumbnailAsync';
import fileSizeToHumanReadable from '@/utils/fileSizeToHumanReadable';

// Exponential moving average time constant (seconds).
// Higher = smoother but slower to react. 10s gives a stable readable number.
const EMA_TAU = 10;

// The backup's progress state around the run itself (sync/backupRun.ts, which owns the one run and
// its stop).
export default function CloudSyncProvider({ children }) {
  const { isAuthenticated } = useCloud();
  const { paths } = useLibrary();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncProgressMessage, setSyncProgressMessage] = useState(null);
  const [syncSpeedMessage, setSyncSpeedMessage] = useState(null);
  const [backupError, setBackupError] = useState(null);

  const lastProgressRef = useRef(null);
  const emaSpeedRef = useRef(0);
  const sessionStartRef = useRef(null);
  const completedBytesRef = useRef(0);
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

  // The uploads of one run, for the session and the library it started with, under the run's signal.
  function uploadsFor(identity, library) {
    return (signal) => ({
      ensureThumbnail: (asset) => ensureAssetThumbnailAsync(asset, { library }),
      uploadFile: async (asset) => {
        lastProgressRef.current = null;
        emaSpeedRef.current = 0;
        let fileTotalBytes = 0;
        await uploadFileAsync(asset.filename, getAssetFileUri(asset.filename, library), identity, {
          signal,
          onProgress: (progress) => {
            fileTotalBytes = progress.totalBytesExpectedToSend;
            updateSyncProgressMessage(progress);
          },
        });
        completedBytesRef.current += fileTotalBytes;
        setSyncProgressMessage(null);
        setSyncSpeedMessage(null);
      },
      uploadThumbnail: (asset) =>
        uploadFileAsync(asset.thumbnailFilename, getAssetThumbnailUri(asset.thumbnailFilename, library), identity, {
          signal,
        }),
      deleteFile: (filename) => removeAssetFiles([{ filename }], library),
    });
  }

  // The run backs up for the user and the library of its start. None starts while the session or
  // the library is changing (a sign-in's merge is still moving files): runBackup is null then.
  async function syncAssets() {
    const identity = isAuthenticated && !isBackupRunning() ? currentSyncIdentity() : null;
    if (!identity) return;
    const run = runBackup(getDb(), {
      uploads: uploadsFor(identity, paths),
      onProgress: ({ index, total }) => setSyncMessage(`Syncing ${index + 1} of ${total}`),
    });
    if (!run) return;

    setIsSyncing(true);
    sessionStartRef.current = Date.now();
    completedBytesRef.current = 0;
    setBackupError(null);

    try {
      await run;
    } catch (error) {
      // Not an upload (those are marked per asset): the run itself couldn't go on.
      console.error('Backup failed', error);
      setBackupError(error.message);
    } finally {
      setIsSyncing(false);
      setSyncMessage(null);
      setSyncProgressMessage(null);
      setSyncSpeedMessage(null);
    }
  }

  const value = useMemo(
    () => ({
      backupError,
      isSyncing,
      syncMessage,
      syncProgressMessage,
      syncSpeedMessage,
      syncNow: syncAssets,
    }),
    [isAuthenticated, backupError, isSyncing, syncMessage, syncProgressMessage, syncSpeedMessage],
  );

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}
