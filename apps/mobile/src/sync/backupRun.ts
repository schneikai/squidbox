import { isUnsynced, readUnsyncedIds, setSyncError, updateAsset } from './assetsRepository';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
import { startRun } from './runGate';
import { requestSync } from './worker';

import SessionChangedError from '@/utils/cloud-api/SessionChangedError';

type BackupAsset = schema.AssetRow;

// The uploads of one asset, bound by the caller to the session the run started for (the upload
// helpers refuse another user's session) and to the run's abort signal (an upload in flight is
// cancelled).
export interface BackupUploads {
  uploadFile(asset: BackupAsset): Promise<void>;
  uploadThumbnail(asset: BackupAsset): Promise<void>;
  deleteFile(filename: string): Promise<void>;
}

interface BackupRunOptions {
  uploads(signal: AbortSignal): BackupUploads;
  onProgress?(progress: { index: number; total: number }): void;
}

let running = false;

export function isBackupRunning(): boolean {
  return running;
}

/**
 * Backs up the assets unsynced at the start, in id order: upload the file and mark it, delete the
 * local copy, upload the thumbnail and mark the asset synced; a failed upload sets syncError and
 * the run goes on. One run at a time, through the run gate: null while a pause holds. An abort (or
 * a session change) ends the run between steps, so nothing is marked or deleted for a session the
 * run no longer belongs to, and no syncError is written for the interrupted upload.
 */
export function runBackup(db: SyncDb, options: BackupRunOptions): Promise<void> | null {
  if (running) throw new Error('A backup is already running');
  const run = startRun(async (signal) => backupAssets(db, await readUnsyncedIds(db), signal, options));
  if (!run) return null;
  running = true;
  return run.finally(() => {
    running = false;
  });
}

async function backupAssets(
  db: SyncDb,
  ids: string[],
  signal: AbortSignal,
  { uploads, onProgress }: BackupRunOptions,
): Promise<void> {
  const bound = uploads(signal);
  for (const [index, id] of ids.entries()) {
    if (signal.aborted) return;
    onProgress?.({ index, total: ids.length });
    const [asset] = await readByIds<BackupAsset>(db, schema.assets, [id]);
    if (!asset || !isUnsynced(asset)) continue;
    if (await backupAsset(db, asset, bound, signal)) return;
  }
}

// Resolves whether the run was aborted on this asset.
async function backupAsset(db: SyncDb, asset: BackupAsset, uploads: BackupUploads, signal: AbortSignal) {
  try {
    if (!asset.isFileSynced) {
      await uploads.uploadFile(asset);
      if (signal.aborted) return true;
      await updateAsset(db, asset.id, { isFileSynced: true });
      // The local file isn't needed any more: it's in the cloud now.
      await uploads.deleteFile(asset.filename);
    }
    if (signal.aborted) return true;
    // The thumbnail stays on the device, the app shows it.
    if (!asset.isThumbnailSynced) await uploads.uploadThumbnail(asset);
    if (signal.aborted) return true;
    await updateAsset(db, asset.id, { isThumbnailSynced: true, isSynced: true });
    requestSync();
    return false;
  } catch (error) {
    if (error instanceof SessionChangedError) throw error; // the run gate ends the run on it
    if (signal.aborted) return true;
    // The other assets still get their turn; the error shows in the UI with a retry.
    await setSyncError(db, [asset.id], error instanceof Error ? error.message : String(error));
    return false;
  }
}
