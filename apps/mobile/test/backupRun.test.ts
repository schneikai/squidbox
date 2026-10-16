import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import { isBackupRunning, runBackup, type BackupUploads } from '../src/sync/backupRun';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { withSyncPaused } from '../src/sync/worker';
import SessionChangedError from '../src/utils/cloud-api/SessionChangedError';

describe('runBackup', () => {
  let db: SyncDb;
  let calls: string[];
  let deleted: string[];

  beforeEach(() => {
    db = makeTestDb();
    calls = [];
    deleted = [];
  });

  async function unsyncedAsset(filename: string) {
    return repo.createAsset(
      db,
      makeAssetRecord({ filename, isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
  }

  const uploads =
    (over: Partial<BackupUploads> = {}) =>
    (): BackupUploads => ({
      uploadFile: async (asset) => {
        calls.push(`file ${asset.filename}`);
      },
      uploadThumbnail: async (asset) => {
        calls.push(`thumbnail ${asset.filename}`);
      },
      deleteFile: async (filename) => {
        deleted.push(filename);
      },
      ...over,
    });

  // A pause that starts during the run: the session or the library is about to change.
  const pause = () => withSyncPaused(async () => {});

  const row = async (id: string) => (await db.select().from(schema.assets)).find((asset) => asset.id === id)!;

  it('uploads file and thumbnail, marks the asset synced and removes the local file', async () => {
    const a = await unsyncedAsset('a.jpg');
    const progress: number[] = [];

    await runBackup(db, { uploads: uploads(), onProgress: ({ index }) => progress.push(index) });

    expect(calls).toEqual(['file a.jpg', 'thumbnail a.jpg']);
    expect(deleted).toEqual(['a.jpg']);
    expect(await row(a.id)).toMatchObject({
      isFileSynced: true,
      isThumbnailSynced: true,
      isSynced: true,
      syncError: null,
    });
    expect(progress).toEqual([0]);
    expect(isBackupRunning()).toBe(false);
  });

  it('a failed upload sets syncError, keeps the file and the run goes on', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');

    await runBackup(db, {
      uploads: uploads({
        uploadFile: async (asset) => {
          if (asset.filename === 'a.jpg') throw new Error('boom');
          calls.push(`file ${asset.filename}`);
        },
      }),
    });

    expect(await row(a.id)).toMatchObject({ isFileSynced: false, syncError: 'boom' });
    expect(deleted).toEqual(['b.jpg']);
    expect(await row(b.id)).toMatchObject({ isSynced: true });
  });

  it('skips an asset that was synced or deleted meanwhile', async () => {
    const a = await unsyncedAsset('a.jpg');
    const gone = await unsyncedAsset('gone.jpg');
    const run = runBackup(db, { uploads: uploads() }); // reads the ids, then each row again
    await repo.updateAsset(db, a.id, { isFileSynced: true, isThumbnailSynced: true, isSynced: true });
    await repo.deleteAssets(db, [gone.id]);

    await run;
    expect(calls).toEqual([]);
  });

  it('a pause after the first upload leaves the next asset untouched and waits for the run', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');
    let paused: Promise<void> | undefined;

    await runBackup(db, {
      uploads: uploads({
        uploadFile: async (asset) => {
          calls.push(`file ${asset.filename}`);
          paused = pause(); // the session changes while the first file uploads
        },
      }),
    });

    expect(isBackupRunning()).toBe(false);
    await paused;
    expect(calls).toHaveLength(1); // the run walks the ids in id order: one upload, then the stop
    expect(deleted).toEqual([]);
    expect(await row(a.id)).toMatchObject({ isFileSynced: false, isSynced: false, syncError: null });
    expect(await row(b.id)).toMatchObject({ isFileSynced: false, isSynced: false, syncError: null });
  });

  it('a cancelled upload is not a failure', async () => {
    const a = await unsyncedAsset('a.jpg');
    let paused: Promise<void> | undefined;

    await runBackup(db, {
      uploads: uploads({
        uploadFile: async () => {
          paused = pause();
          throw new Error('Upload cancelled');
        },
      }),
    });

    await paused;
    expect(await row(a.id)).toMatchObject({ isFileSynced: false, syncError: null });
  });

  it('an upload the session change refused ends the run without a syncError', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');

    await runBackup(db, {
      uploads: uploads({
        uploadFile: async () => {
          throw new SessionChangedError('Signed in as someone else');
        },
      }),
    });

    expect(isBackupRunning()).toBe(false);
    expect(await row(a.id)).toMatchObject({ isFileSynced: false, syncError: null });
    expect(await row(b.id)).toMatchObject({ isFileSynced: false, syncError: null });
  });

  it('stops before the thumbnail upload and before the next asset', async () => {
    const a = await unsyncedAsset('a.jpg');
    let paused: Promise<void> | undefined;

    await runBackup(db, {
      uploads: uploads({
        deleteFile: async (filename) => {
          deleted.push(filename);
          paused = pause();
        },
      }),
    });

    await paused;
    expect(calls).toEqual(['file a.jpg']);
    expect(await row(a.id)).toMatchObject({ isFileSynced: true, isThumbnailSynced: false, isSynced: false });
  });

  it('refuses a second run while one is running, and does not start while a pause holds', async () => {
    const a = await unsyncedAsset('a.jpg');
    let release!: () => void;
    const first = runBackup(db, {
      uploads: uploads({ uploadFile: () => new Promise<void>((resolve) => (release = resolve)) }),
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(isBackupRunning()).toBe(true);
    expect(() => runBackup(db, { uploads: uploads() })).toThrow('already running');
    release();
    await first;
    expect(await row(a.id)).toMatchObject({ isSynced: true });

    await withSyncPaused(async () => {
      expect(runBackup(db, { uploads: uploads() })).toBeNull();
      expect(isBackupRunning()).toBe(false);
    });
  });
});
