import type { UploadProgress } from 'expo-file-system';
import { useState, useRef, useMemo, type ReactNode } from 'react';

import CloudSyncContext, { type CloudSyncValue } from './CloudSyncContext';

import type { OpenLibrary } from '@/library/current';
import { currentSyncIdentity } from '@/library/currentSyncIdentity';
import { removeAssetFiles } from '@/library/fs';
import type { SyncIdentity } from '@/library/sessionMatches';
import useOpenLibrary from '@/library/useOpenLibrary';
import useCloud from '@/providers/cloud/useCloud';
import { isBackupRunning, runBackup, type BackupUploads } from '@/sync/backupRun';
import { getDb } from '@/sync/db/client';
import { getAssetFileUri, getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import ensureAssetThumbnailAsync from '@/utils/assets/thumbnails/ensureAssetThumbnailAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import uploadFileAsync from '@/utils/cloud-api/assets/uploadFileAsync';
import fileSizeToHumanReadable from '@/utils/fileSizeToHumanReadable';

// Exponential moving average time constant (seconds).
// Higher = smoother but slower to react. 10s gives a stable readable number.
const EMA_TAU = 10;

export type CloudSyncProviderProps = { children: ReactNode };

// The backup's progress state around the run itself (sync/backupRun.ts, which owns the one run and
// its stop).
export default function CloudSyncProvider({ children }: CloudSyncProviderProps) {
  const { isAuthenticated } = useCloud();
  const { paths } = useOpenLibrary();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncProgressMessage, setSyncProgressMessage] = useState<CloudSyncValue['syncProgressMessage']>(null);
  const [syncSpeedMessage, setSyncSpeedMessage] = useState<CloudSyncValue['syncSpeedMessage']>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const lastProgressRef = useRef<{ bytes: number; time: number } | null>(null);
  const emaSpeedRef = useRef(0);
  const sessionStartRef = useRef(0);
  const completedBytesRef = useRef(0);
  function updateSyncProgressMessage({ bytesSent, totalBytes }: UploadProgress) {
    const now = Date.now();

    if (lastProgressRef.current) {
      const elapsedSeconds = (now - lastProgressRef.current.time) / 1000;
      const bytesDelta = bytesSent - lastProgressRef.current.bytes;
      if (elapsedSeconds > 0 && bytesDelta >= 0) {
        const instantSpeed = bytesDelta / elapsedSeconds;
        // Exponential moving average — weights recent samples more heavily
        // while smoothing over ~EMA_TAU seconds to avoid a flickery display.
        const alpha = 1 - Math.exp(-elapsedSeconds / EMA_TAU);
        emaSpeedRef.current = alpha * instantSpeed + (1 - alpha) * emaSpeedRef.current;
      }
    }

    lastProgressRef.current = { bytes: bytesSent, time: now };

    const sessionElapsed = (now - sessionStartRef.current) / 1000;
    const sessionTotalBytes = completedBytesRef.current + bytesSent;
    const sessionAvgSpeed = sessionElapsed > 0 ? sessionTotalBytes / sessionElapsed : 0;

    setSyncSpeedMessage({
      now: `${fileSizeToHumanReadable(emaSpeedRef.current)}/s`,
      avg: `${fileSizeToHumanReadable(sessionAvgSpeed)}/s`,
    });

    const uploadPercent = Math.round((bytesSent / totalBytes) * 100);
    setSyncProgressMessage({
      sent: fileSizeToHumanReadable(bytesSent),
      total: fileSizeToHumanReadable(totalBytes),
      percent: `${uploadPercent}%`,
    });
  }

  // The uploads of one run, for the session and the library it started with, under the run's signal.
  function uploadsFor(identity: SyncIdentity, library: OpenLibrary): (signal: AbortSignal) => BackupUploads {
    return (signal) => ({
      ensureThumbnail: (asset) => ensureAssetThumbnailAsync(asset, { library }),
      uploadFile: async (asset) => {
        lastProgressRef.current = null;
        emaSpeedRef.current = 0;
        let fileTotalBytes = 0;
        await uploadFileAsync(asset.filename, getAssetFileUri(asset.filename, library), identity, {
          signal,
          onProgress: (progress) => {
            fileTotalBytes = progress.totalBytes;
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
      setBackupError(apiErrorMessage(error));
    } finally {
      setIsSyncing(false);
      setSyncMessage(null);
      setSyncProgressMessage(null);
      setSyncSpeedMessage(null);
    }
  }

  const value = useMemo<CloudSyncValue>(
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
