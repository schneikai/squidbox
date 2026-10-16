import { isUnsynced, setSyncError, updateAsset } from './assetsRepository';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
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

export interface BackupRunOptions {
  uploads(signal: AbortSignal): BackupUploads;
  onProgress?(progress: { index: number; total: number }): void;
}

export type BackupOutcome = 'completed' | 'aborted';

// The one run in progress: it owns the abort controller, and stopBackup is the only stop (the sync
// pause asks for it before a session or library change).
let running: { controller: AbortController; done: Promise<unknown> } | null = null;

export function isBackupRunning(): boolean {
  return running !== null;
}

export async function stopBackup(): Promise<void> {
  if (!running) return;
  running.controller.abort();
  await running.done;
}

/**
 * Backs up the assets with these ids, in order: upload the file and mark it, delete the local copy,
 * upload the thumbnail and mark the asset synced. A failed upload sets the asset's syncError and
 * the run goes on. Each row is read again right before its upload, so one synced, failed or deleted
 * meanwhile is skipped. The run stops before each asset, between an upload and its mark, and
 * before the thumbnail upload once it is aborted, and an upload the session change refused ends it
 * the same way: nothing is marked or deleted for a session the run no longer belongs to, and no
 * syncError is written for the interrupted upload. One run at a time.
 */
// `ids` may still be loading: the run is registered before they are read, so a pause that starts
// meanwhile stops it.
export async function runBackup(
  db: SyncDb,
  ids: string[] | Promise<string[]>,
  options: BackupRunOptions,
): Promise<BackupOutcome> {
  if (running) throw new Error('A backup is already running');
  const controller = new AbortController();
  const done = backupAssets(db, ids, controller.signal, options);
  running = { controller, done: done.catch(() => {}) };
  try {
    return await done;
  } finally {
    running = null;
  }
}

async function backupAssets(
  db: SyncDb,
  loadingIds: string[] | Promise<string[]>,
  signal: AbortSignal,
  { uploads, onProgress }: BackupRunOptions,
): Promise<BackupOutcome> {
  const ids = await loadingIds;
  const bound = uploads(signal);
  for (const [index, id] of ids.entries()) {
    if (signal.aborted) return 'aborted';
    onProgress?.({ index, total: ids.length });
    const [asset] = await readByIds<BackupAsset>(db, schema.assets, [id]);
    if (!asset || !isUnsynced(asset)) continue;
    if (await backupAsset(db, asset, bound, signal)) return 'aborted';
  }
  return 'completed';
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
    if (signal.aborted || error instanceof SessionChangedError) return true;
    // The other assets still get their turn; the error shows in the UI with a retry.
    await setSyncError(db, [asset.id], error instanceof Error ? error.message : String(error));
    return false;
  }
}
