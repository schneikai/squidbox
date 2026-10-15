import { isUnsynced, setSyncError, updateAsset } from './assetsRepository';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
import { requestSync } from './worker';

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
  uploads: BackupUploads;
  // Aborted when the session or the library changes (by the caller, or by stopBackup): the run
  // stops at its next step without marking anything.
  controller: AbortController;
  onProgress?(progress: { index: number; total: number }): void;
}

export type BackupOutcome = 'completed' | 'aborted';

// The run in progress, if any: the library switch stops it and waits for it before closing.
let running: { abort: () => void; done: Promise<unknown> } | null = null;

export async function stopBackup(): Promise<void> {
  if (!running) return;
  running.abort();
  await running.done;
}

/**
 * Backs up the assets with these ids, in order: upload the file and mark it, delete the local copy,
 * upload the thumbnail and mark the asset synced. A failed upload sets the asset's syncError and
 * the run goes on. Each row is read again right before its upload, so one synced, failed or deleted
 * meanwhile is skipped. The run stops before each asset, between an upload and its mark, and
 * before the thumbnail upload once `signal` is aborted: nothing is marked or deleted for a session
 * the run no longer belongs to, and no syncError is written for the interrupted upload.
 */
export async function runBackup(db: SyncDb, ids: string[], options: BackupRunOptions): Promise<BackupOutcome> {
  const done = backupAssets(db, ids, options);
  running = { abort: () => options.controller.abort(), done: done.catch(() => {}) };
  try {
    return await done;
  } finally {
    running = null;
  }
}

async function backupAssets(db: SyncDb, ids: string[], options: BackupRunOptions): Promise<BackupOutcome> {
  const { signal } = options.controller;
  for (const [index, id] of ids.entries()) {
    if (signal.aborted) return 'aborted';
    options.onProgress?.({ index, total: ids.length });
    const [asset] = await readByIds<BackupAsset>(db, schema.assets, [id]);
    if (!asset || !isUnsynced(asset)) continue;
    if ((await backupAsset(db, asset, options)) === 'aborted') return 'aborted';
  }
  return 'completed';
}

async function backupAsset(db: SyncDb, asset: BackupAsset, { uploads, controller: { signal } }: BackupRunOptions) {
  try {
    if (!asset.isFileSynced) {
      await uploads.uploadFile(asset);
      if (signal.aborted) return 'aborted';
      await updateAsset(db, asset.id, { isFileSynced: true });
      // The local file isn't needed any more: it's in the cloud now.
      await uploads.deleteFile(asset.filename);
    }
    if (signal.aborted) return 'aborted';
    // The thumbnail stays on the device, the app shows it.
    if (!asset.isThumbnailSynced) await uploads.uploadThumbnail(asset);
    if (signal.aborted) return 'aborted';
    await updateAsset(db, asset.id, { isThumbnailSynced: true, isSynced: true });
    requestSync();
    return 'done';
  } catch (error) {
    if (signal.aborted) return 'aborted';
    // The other assets still get their turn; the error shows in the UI with a retry.
    await setSyncError(db, [asset.id], error instanceof Error ? error.message : String(error));
    return 'failed';
  }
}
