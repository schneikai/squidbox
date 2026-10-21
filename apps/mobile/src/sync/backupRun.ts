import { isUnsynced, readUnsyncedIds, setSyncError, updateAsset } from './assetsRepository';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { pendingUpdatedAt } from './outbox';
import { readByIds } from './readByIds';
import { startRun } from './runGate';
import { requestSync } from './worker';

import SessionChangedError from '@/utils/cloud-api/SessionChangedError';

type BackupAsset = schema.AssetRow;

// The uploads of one asset, bound by the caller to the session the run started for (the upload
// helpers refuse another user's session) and to the run's abort signal (an upload in flight is
// cancelled).
export interface BackupUploads {
  // Whether the thumbnail is on the device, made again from the original if it was missing.
  ensureThumbnail(asset: BackupAsset): Promise<boolean>;
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
 * Backs up the assets unsynced at the start whose record the server has confirmed, in id order:
 * make a missing thumbnail again, upload the file and the thumbnail at once, mark what uploaded in
 * one write (nothing for an asset deleted or purged meanwhile), then delete the local copy of an
 * uploaded file (kept while its thumbnail can't be made); a failed upload or write sets syncError
 * (what did upload is still marked) and the run goes on. One run at a time, through the run gate:
 * null while a pause holds. An abort ends the run once the asset's uploads settled: an upload that
 * finished before it is still marked (the pause waits for the run, so the session and library are
 * still the run's), an interrupted one is neither marked nor a syncError. A session that changed
 * under the run (SessionChangedError) ends it with nothing marked or deleted for the asset.
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
    if (!asset || !isUnsynced(asset) || (await isUnconfirmed(db, id))) continue;
    if (await backupAsset(db, asset, bound, signal)) return;
  }
}

// Whether the server has yet to confirm the asset's record: it has an outbox row, pending or failed
// (§6). Such an asset waits: its original is deleted once uploaded, so the server must have its
// record first, and a push that keeps failing would otherwise upload the file on every run.
async function isUnconfirmed(db: SyncDb, id: string): Promise<boolean> {
  return (await pendingUpdatedAt(db, 'assets', [id])).has(id);
}

// Resolves whether the run was aborted on this asset.
async function backupAsset(db: SyncDb, asset: BackupAsset, uploads: BackupUploads, signal: AbortSignal) {
  // First, while the original is still here (it's deleted below once uploaded): a merge brings
  // originals without their thumbnails, and those are made again from it.
  const thumbnailError = asset.isThumbnailSynced ? null : await missingThumbnail(uploads, asset);
  const [file, thumbnail] = await Promise.allSettled([
    !asset.isFileSynced && finishedBeforeAbort(uploads.uploadFile(asset), signal),
    // The thumbnail stays on the device, the app shows it.
    !asset.isThumbnailSynced &&
      (thumbnailError ? Promise.reject(thumbnailError) : finishedBeforeAbort(uploads.uploadThumbnail(asset), signal)),
  ]);
  const failures = [file, thumbnail].flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  const sessionChanged = failures.find((error) => error instanceof SessionChangedError);
  if (sessionChanged) throw sessionChanged; // the run gate ends the run on it
  const uploaded = {
    file: file.status === 'fulfilled' && file.value,
    thumbnail: thumbnail.status === 'fulfilled' && thumbnail.value,
  };
  try {
    // An abort interrupts the uploads still running: not failures.
    const marked = await markAsset(db, asset.id, uploaded, signal.aborted ? [] : failures);
    if (marked) requestSync();
    // The local file isn't needed any more once it's in the cloud and marked so, the thumbnail
    // uploaded or not, unless the thumbnail couldn't be made from it: it's kept to make it again, and
    // goes once a later run uploaded the thumbnail.
    const isFileInCloud = uploaded.file || (asset.isFileSynced && uploaded.thumbnail);
    if (marked && isFileInCloud && !thumbnailError) await deleteOriginal(uploads, asset.filename);
  } catch (error) {
    if (signal.aborted) return true;
    // The other assets still get their turn; the error shows in the UI with a retry.
    await setSyncError(db, [asset.id], errorMessage(error));
  }
  return signal.aborted;
}

// Resolves why the asset's thumbnail isn't on the device, if it isn't.
async function missingThumbnail(uploads: BackupUploads, asset: BackupAsset): Promise<unknown> {
  try {
    if (await uploads.ensureThumbnail(asset)) return null;
    return new Error('Its thumbnail and original are both missing from this device');
  } catch (error) {
    return error;
  }
}

// Resolves whether the upload finished before an abort: only such an upload is marked.
async function finishedBeforeAbort(upload: Promise<void>, signal: AbortSignal): Promise<boolean> {
  await upload;
  return !signal.aborted;
}

// Marks what uploaded and records the first failure in one write, unless the asset was deleted or
// purged meanwhile; resolves whether it marked anything (a new version to push). The syncError is
// local-only, so a write that only sets it makes no new version.
async function markAsset(
  db: SyncDb,
  id: string,
  uploaded: { file: boolean; thumbnail: boolean },
  failures: unknown[],
): Promise<boolean> {
  if (!uploaded.file && !uploaded.thumbnail && failures.length === 0) return false;
  return db.transaction(async (tx) => {
    const [row] = await readByIds<BackupAsset>(tx, schema.assets, [id]);
    if (!row || row.deletedAt !== null || row.purgedAt !== null) return false;
    const changes: Partial<BackupAsset> = {};
    if (uploaded.file && !row.isFileSynced) changes.isFileSynced = true;
    if (uploaded.thumbnail && !row.isThumbnailSynced) changes.isThumbnailSynced = true;
    const marked = Object.keys(changes).length > 0;
    if (marked)
      await updateAsset(tx, id, {
        ...changes,
        isSynced: (row.isFileSynced || uploaded.file) && (row.isThumbnailSynced || uploaded.thumbnail),
      });
    if (failures.length > 0) await setSyncError(tx, [id], errorMessage(failures[0]));
    return marked;
  });
}

// A failed delete only leaves a copy the cloud already has: not an upload error, so not a syncError.
async function deleteOriginal(uploads: BackupUploads, filename: string) {
  await uploads
    .deleteFile(filename)
    .catch((error) => console.warn('Could not delete the uploaded original', filename, error));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
