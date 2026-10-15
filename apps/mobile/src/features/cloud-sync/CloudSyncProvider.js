import { useEffect, useState, useRef, useMemo } from 'react';

import CloudSyncContext from './CloudSyncContext';

import useCloud from '@/features/cloud/useCloud';
import { getLibrary } from '@/library/current';
import { readUnsyncedIds } from '@/sync/assetsRepository';
import { runBackup } from '@/sync/backupRun';
import { getDb } from '@/sync/db/client';
import deleteAssetFileAsync from '@/utils/assets/files/deleteAssetFileAsync';
import requireSessionAsync from '@/utils/cloud-api/requireSessionAsync';
import { sessionIdentity } from '@/utils/cloud-api/sessionIdentity';
import fileSizeToHumanReadable from '@/utils/fileSizeToHumanReadable';

// Exponential moving average time constant (seconds).
// Higher = smoother but slower to react. 10s gives a stable readable number.
const EMA_TAU = 10;

// The backup's progress state around the run itself (sync/backupRun.ts).
export default function CloudSyncProvider({ children }) {
  const { isAuthenticated, user, uploadAssetFileAsync, uploadAssetThumbnailAsync } = useCloud();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncProgressMessage, setSyncProgressMessage] = useState(null);
  const [syncSpeedMessage, setSyncSpeedMessage] = useState(null);
  const [backupError, setBackupError] = useState(null);

  // The running backup's abort controller: one run at a time, stopped when the session changes.
  const runRef = useRef(null);
  const lastProgressRef = useRef(null);
  const emaSpeedRef = useRef(0);
  const sessionStartRef = useRef(null);
  const completedBytesRef = useRef(0);

  const signedInUserId = isAuthenticated ? user?.id : null;

  // A run belongs to the user signed in at its start: once that changes (or the provider goes), it
  // stops, cancelling an upload in flight.
  useEffect(() => () => runRef.current?.abort(), [signedInUserId]);

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

  // The uploads of one run, for the session and the library it started with, under its abort signal.
  function uploadsFor(identity, library, signal) {
    return {
      uploadFile: async (asset) => {
        lastProgressRef.current = null;
        emaSpeedRef.current = 0;
        let fileTotalBytes = 0;
        await uploadAssetFileAsync(asset, identity, {
          library,
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
      uploadThumbnail: (asset) => uploadAssetThumbnailAsync(asset, identity, { library, signal }),
      deleteFile: (filename) => deleteAssetFileAsync(filename, library),
    };
  }

  // The run backs up the assets unsynced at its start (their ids are read once; assets added
  // meanwhile wait for the next run), for the user and the library of its start.
  async function syncAssets() {
    if (!isAuthenticated || runRef.current) return;
    const controller = new AbortController();
    runRef.current = controller;

    setIsSyncing(true);
    sessionStartRef.current = Date.now();
    completedBytesRef.current = 0;
    setBackupError(null);

    try {
      const db = getDb();
      const library = getLibrary();
      const identity = sessionIdentity(await requireSessionAsync());
      const ids = await readUnsyncedIds(db);
      await runBackup(db, ids, {
        uploads: uploadsFor(identity, library, controller.signal),
        signal: controller.signal,
        onProgress: ({ index, total }) => setSyncMessage(`Syncing ${index + 1} of ${total}`),
      });
    } catch (error) {
      // Not an upload (those are marked per asset): the run itself couldn't go on.
      console.error('Backup failed', error);
      setBackupError(error.message);
    } finally {
      setIsSyncing(false);
      setSyncMessage(null);
      setSyncProgressMessage(null);
      setSyncSpeedMessage(null);
      runRef.current = null;
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
