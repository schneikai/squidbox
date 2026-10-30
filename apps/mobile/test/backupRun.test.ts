import { describe, it, expect, beforeEach, vi } from 'vitest';

import { deferred } from './helpers/deferred';
import { makeAssetRecord } from './helpers/factory';
import { flushTurns } from './helpers/flushTurns';
import { gate } from './helpers/gate';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import { isBackupRunning, runBackup, type BackupUploads } from '../src/sync/backupRun';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { setOutboxError } from '../src/sync/outbox';
import { withSyncPaused } from '../src/sync/worker';
import SessionChangedError from '../src/utils/cloud-api/SessionChangedError';

describe('runBackup', () => {
  let db: AppDb;
  let calls: string[];
  let deleted: string[];

  beforeEach(() => {
    db = makeTestDb();
    calls = [];
    deleted = [];
  });

  // An asset whose record the server has (pushed: no outbox row left), so the backup takes it.
  async function pushedAsset(fields: Parameters<typeof makeAssetRecord>[0]) {
    const asset = await repo.create(db, makeAssetRecord(fields));
    await db.delete(schema.outbox);
    return asset;
  }

  const unsyncedAsset = (filename: string) =>
    pushedAsset({ filename, isFileSynced: false, isThumbnailSynced: false, isSynced: false });

  const uploads =
    (over: Partial<BackupUploads> = {}) =>
    (): BackupUploads => ({
      ensureThumbnail: async () => true,
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

  // How many committed units (each one notification) wrote the assets table while `run` ran.
  async function assetWrites(run: () => Promise<unknown>): Promise<number> {
    let writes = 0;
    const stop = db.onTablesChanged((tables) => tables.has('assets') && writes++);
    await run();
    stop();
    return writes;
  }

  it('uploads file and thumbnail at once, marks the asset synced in one write, then removes the local file', async () => {
    const a = await unsyncedAsset('a.jpg');
    const progress: number[] = [];
    const file = deferred();
    const thumbnail = deferred();
    let flagsWhenDeleted: Partial<schema.AssetRow> | undefined;
    const run = runBackup(db, {
      uploads: uploads({
        uploadFile: async (asset) => {
          calls.push(`file ${asset.filename}`);
          await file.promise;
        },
        uploadThumbnail: async (asset) => {
          calls.push(`thumbnail ${asset.filename}`);
          await thumbnail.promise;
        },
        deleteFile: async (filename) => {
          deleted.push(filename);
          flagsWhenDeleted = await row(a.id);
        },
      }),
      onProgress: ({ index }) => progress.push(index),
    })!;

    const writes = await assetWrites(async () => {
      await flushTurns();
      expect(calls).toEqual(['file a.jpg', 'thumbnail a.jpg']); // both in flight
      thumbnail.resolve();
      await flushTurns();
      expect(deleted).toEqual([]);
      file.resolve();
      await run;
    });

    expect(writes).toBe(1);
    expect(deleted).toEqual(['a.jpg']);
    expect(flagsWhenDeleted).toMatchObject({ isFileSynced: true, isSynced: true });
    expect(await row(a.id)).toMatchObject({
      isFileSynced: true,
      isThumbnailSynced: true,
      isSynced: true,
      syncError: null,
    });
    expect(progress).toEqual([0]);
    expect(isBackupRunning()).toBe(false);
  });

  it('uploads only what is missing', async () => {
    const a = await pushedAsset({ filename: 'a.jpg', isFileSynced: true, isThumbnailSynced: false, isSynced: false });

    await runBackup(db, { uploads: uploads() });

    expect(calls).toEqual(['thumbnail a.jpg']);
    // Its original was deleted when it uploaded, unless it was kept to make the thumbnail again.
    expect(deleted).toEqual(['a.jpg']);
    expect(await row(a.id)).toMatchObject({ isThumbnailSynced: true, isSynced: true });
  });

  it('makes a missing thumbnail again before the uploads, only for a thumbnail not uploaded', async () => {
    await unsyncedAsset('a.jpg');
    await pushedAsset({ filename: 'b.jpg', isFileSynced: false, isThumbnailSynced: true, isSynced: false });
    const ensureThumbnail = async (asset: schema.AssetRow) => {
      calls.push(`ensure ${asset.filename}`);
      return true;
    };

    await runBackup(db, { uploads: uploads({ ensureThumbnail }) });

    const ofA = calls.filter((call) => call.endsWith('a.jpg'));
    expect(ofA).toEqual(['ensure a.jpg', 'file a.jpg', 'thumbnail a.jpg']);
    expect(calls.filter((call) => call.endsWith('b.jpg'))).toEqual(['file b.jpg']);
  });

  it('a thumbnail that can’t be made again sets syncError; the file still uploads, its original stays', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');
    const ensureThumbnail = async (asset: schema.AssetRow) => {
      if (asset.id === b.id) throw new Error('unreadable video');
      return false;
    };

    await runBackup(db, { uploads: uploads({ ensureThumbnail }) });

    expect(calls.sort()).toEqual(['file a.jpg', 'file b.jpg']);
    expect(deleted).toEqual([]); // b's to make its thumbnail from on the next run (a has none)
    expect(await row(a.id)).toMatchObject({
      isFileSynced: true,
      isThumbnailSynced: false,
      syncError: 'Its thumbnail and original are both missing from this device',
    });
    expect(await row(b.id)).toMatchObject({ isFileSynced: true, syncError: 'unreadable video' });
  });

  it('an original kept for its thumbnail goes once a later run uploaded the thumbnail', async () => {
    const a = await unsyncedAsset('a.jpg');
    const ensureThumbnail = async () => {
      throw new Error('out of memory');
    };
    await runBackup(db, { uploads: uploads({ ensureThumbnail }) });
    expect(deleted).toEqual([]);

    await db.delete(schema.outbox); // the marked file pushed
    await repo.clearSyncErrors(db); // the user's retry
    await runBackup(db, { uploads: uploads() });

    expect(calls).toEqual(['file a.jpg', 'thumbnail a.jpg']);
    expect(deleted).toEqual(['a.jpg']);
    expect(await row(a.id)).toMatchObject({ isSynced: true, syncError: null });
  });

  it('a failed file upload sets syncError, marks the thumbnail, keeps the file and the run goes on', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');

    const writes = await assetWrites(() =>
      runBackup(db, {
        uploads: uploads({
          uploadFile: async (asset) => {
            if (asset.filename === 'a.jpg') throw new Error('boom');
            calls.push(`file ${asset.filename}`);
          },
        }),
      })!,
    );

    expect(writes).toBe(2); // the first asset's flags and error in one transaction, the next one's flags
    expect(await row(a.id)).toMatchObject({
      isFileSynced: false,
      isThumbnailSynced: true,
      isSynced: false,
      syncError: 'boom',
    });
    expect(deleted).toEqual(['b.jpg']);
    expect(await row(b.id)).toMatchObject({ isSynced: true });
  });

  it('a failed thumbnail upload marks the file and removes the original once its upload resolved', async () => {
    const a = await unsyncedAsset('a.jpg');
    const file = deferred();
    const run = runBackup(db, {
      uploads: uploads({
        uploadFile: async () => {
          await file.promise;
          calls.push('file resolved');
        },
        uploadThumbnail: async () => {
          throw new Error('no thumbnail');
        },
      }),
    })!;

    const writes = await assetWrites(async () => {
      await flushTurns();
      expect(deleted).toEqual([]); // the thumbnail failed, the file is still uploading
      file.resolve();
      await run;
    });

    expect(writes).toBe(1); // the flags and the local-only error in one transaction
    expect(calls).toEqual(['file resolved']);
    expect(deleted).toEqual(['a.jpg']);
    expect(await row(a.id)).toMatchObject({
      isFileSynced: true,
      isThumbnailSynced: false,
      isSynced: false,
      syncError: 'no thumbnail',
    });
  });

  it('both uploads failing only sets syncError', async () => {
    const a = await unsyncedAsset('a.jpg');
    const fail = async () => {
      throw new Error('offline');
    };

    await runBackup(db, { uploads: uploads({ uploadFile: fail, uploadThumbnail: fail }) });

    expect(deleted).toEqual([]);
    expect(await row(a.id)).toMatchObject({
      isFileSynced: false,
      isThumbnailSynced: false,
      updatedAt: a.updatedAt, // no new version to push
      syncError: 'offline',
    });
  });

  it('a failed thumbnail upload of an asset whose file is synced only sets syncError', async () => {
    const a = await pushedAsset({ filename: 'a.jpg', isFileSynced: true, isThumbnailSynced: false, isSynced: false });

    const writes = await assetWrites(() =>
      runBackup(db, {
        uploads: uploads({
          uploadThumbnail: async () => {
            throw new Error('offline');
          },
        }),
      })!,
    );

    expect(writes).toBe(1);
    expect(deleted).toEqual([]);
    expect(await row(a.id)).toMatchObject({ isFileSynced: true, updatedAt: a.updatedAt, syncError: 'offline' });
  });

  it('a failed write sets syncError, keeps the original and the run goes on', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('disk full'));

    await runBackup(db, { uploads: uploads() });

    const [first, next] = [await row(a.id), await row(b.id)].sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(first).toMatchObject({ isFileSynced: false, isSynced: false, syncError: 'disk full' });
    expect(next).toMatchObject({ isSynced: true, syncError: null });
    expect(deleted).toEqual([next!.filename]);
  });

  it('marks nothing and keeps the original of an asset deleted or purged during its uploads', async () => {
    const gone = await unsyncedAsset('gone.jpg');
    const purged = await unsyncedAsset('purged.jpg');

    await runBackup(db, {
      uploads: uploads({
        uploadFile: async (asset) => {
          if (asset.id === gone.id) await repo.remove(db, [gone.id]);
          else await repo.update(db, purged.id, { purgedAt: 1 });
        },
      }),
    });

    expect(deleted).toEqual([]);
    expect(await row(gone.id)).toMatchObject({ isFileSynced: false, isThumbnailSynced: false });
    expect(await row(purged.id)).toMatchObject({ isFileSynced: false, isThumbnailSynced: false });
  });

  it('a pause after the file uploaded but during the thumbnail marks the file and removes the original', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');
    const file = deferred();
    let paused: Promise<void> | undefined;
    const run = runBackup(db, {
      uploads: uploads({
        uploadFile: async () => {
          await file.promise;
        },
        uploadThumbnail: () =>
          file.promise.then(async () => {
            await flushTurns(); // the file upload has resolved
            paused = pause();
            throw new Error('Upload cancelled');
          }),
      }),
    })!;

    file.resolve();
    await run;
    await paused;

    const [first, next] = [await row(a.id), await row(b.id)].sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(first).toMatchObject({ isFileSynced: true, isThumbnailSynced: false, isSynced: false, syncError: null });
    expect(deleted).toEqual([first!.filename]);
    expect(next).toMatchObject({ isFileSynced: false, isSynced: false, syncError: null });
  });

  it('a failed delete of the uploaded original is not a syncError', async () => {
    const a = await unsyncedAsset('a.jpg');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await runBackup(db, {
      uploads: uploads({
        deleteFile: async () => {
          throw new Error('busy');
        },
      }),
    });

    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
    expect(await row(a.id)).toMatchObject({ isSynced: true, syncError: null });
  });

  it('skips an asset that was synced, deleted or purged meanwhile', async () => {
    const a = await unsyncedAsset('a.jpg');
    const gone = await unsyncedAsset('gone.jpg');
    const purged = await unsyncedAsset('purged.jpg');
    const run = runBackup(db, { uploads: uploads() }); // reads the ids, then each row again
    // Queued right behind the ids' read, so they land before the first row's.
    await Promise.all([
      repo.update(db, a.id, { isFileSynced: true, isThumbnailSynced: true, isSynced: true }),
      repo.remove(db, [gone.id]),
      repo.update(db, purged.id, { purgedAt: 1 }),
    ]);

    await run;
    expect(calls).toEqual([]);
  });

  it('skips an asset whose record the server has yet to confirm: its push pending or failed', async () => {
    const unsynced = () => makeAssetRecord({ isFileSynced: false, isThumbnailSynced: false, isSynced: false });
    const pending = await repo.create(db, unsynced());
    const failed = await repo.create(db, unsynced());
    await setOutboxError(db, 'assets', [failed.id], 'schema:boom');

    await runBackup(db, { uploads: uploads() });

    expect(calls).toEqual([]); // nothing uploaded again, no original deleted
    expect(deleted).toEqual([]);
    expect(await row(pending.id)).toMatchObject({ isSynced: false, syncError: null });
    expect(await row(failed.id)).toMatchObject({ isSynced: false, syncError: null });
  });

  it('a pause during the uploads marks nothing, leaves the next asset untouched and waits for the run', async () => {
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
    expect(calls).toHaveLength(2); // the run walks the ids in id order: one asset's uploads, then the stop
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

  it('an upload the session change refused ends the run without marking or a syncError', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');

    await runBackup(db, {
      uploads: uploads({
        uploadThumbnail: async () => {
          throw new SessionChangedError('Signed in as someone else');
        },
      }),
    });

    expect(isBackupRunning()).toBe(false);
    expect(calls).toHaveLength(1); // the first asset's file uploaded, its thumbnail was refused
    expect(deleted).toEqual([]);
    expect(await row(a.id)).toMatchObject({ isFileSynced: false, syncError: null });
    expect(await row(b.id)).toMatchObject({ isFileSynced: false, syncError: null });
  });

  it('a pause after the write still removes the uploaded original, and stops before the next asset', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');
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
    expect(calls).toHaveLength(2);
    expect(deleted).toHaveLength(1);
    const [first, next] = [await row(a.id), await row(b.id)].sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(first).toMatchObject({ filename: deleted[0], isSynced: true });
    expect(next).toMatchObject({ isFileSynced: false, isSynced: false });
  });

  it('refuses a second run while one is running, and does not start while a pause holds', async () => {
    const a = await unsyncedAsset('a.jpg');
    const upload = gate();
    const first = runBackup(db, { uploads: uploads({ uploadFile: upload.hold }) });
    await upload.entered;
    expect(isBackupRunning()).toBe(true);
    expect(() => runBackup(db, { uploads: uploads() })).toThrow('already running');
    upload.release();
    await first;
    expect(await row(a.id)).toMatchObject({ isSynced: true });

    await withSyncPaused(async () => {
      expect(runBackup(db, { uploads: uploads() })).toBeNull();
      expect(isBackupRunning()).toBe(false);
    });
  });
});
