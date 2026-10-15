import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import { runBackup, type BackupUploads } from '../src/sync/backupRun';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';

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

  function uploads(over: Partial<BackupUploads> = {}): BackupUploads {
    return {
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
    };
  }

  const row = async (id: string) => (await db.select().from(schema.assets)).find((asset) => asset.id === id)!;

  it('uploads file and thumbnail, marks the asset synced and removes the local file', async () => {
    const a = await unsyncedAsset('a.jpg');
    const progress: number[] = [];

    const outcome = await runBackup(db, [a.id], {
      uploads: uploads(),
      controller: new AbortController(),
      onProgress: ({ index }) => progress.push(index),
    });

    expect(outcome).toBe('completed');
    expect(calls).toEqual(['file a.jpg', 'thumbnail a.jpg']);
    expect(deleted).toEqual(['a.jpg']);
    expect(await row(a.id)).toMatchObject({
      isFileSynced: true,
      isThumbnailSynced: true,
      isSynced: true,
      syncError: null,
    });
    expect(progress).toEqual([0]);
  });

  it('a failed upload sets syncError, keeps the file and the run goes on', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');

    const outcome = await runBackup(db, [a.id, b.id], {
      uploads: uploads({
        uploadFile: async (asset) => {
          if (asset.filename === 'a.jpg') throw new Error('boom');
          calls.push(`file ${asset.filename}`);
        },
      }),
      controller: new AbortController(),
    });

    expect(outcome).toBe('completed');
    expect(await row(a.id)).toMatchObject({ isFileSynced: false, syncError: 'boom' });
    expect(deleted).toEqual(['b.jpg']);
    expect(await row(b.id)).toMatchObject({ isSynced: true });
  });

  it('skips an asset that was synced or deleted meanwhile', async () => {
    const a = await unsyncedAsset('a.jpg');
    await repo.updateAsset(db, a.id, { isFileSynced: true, isThumbnailSynced: true, isSynced: true });
    const gone = await unsyncedAsset('gone.jpg');
    await repo.deleteAssets(db, [gone.id]);

    expect(await runBackup(db, [a.id, gone.id], { uploads: uploads(), controller: new AbortController() })).toBe(
      'completed',
    );
    expect(calls).toEqual([]);
  });

  it('a session change after the first upload leaves the next asset untouched', async () => {
    const a = await unsyncedAsset('a.jpg');
    const b = await unsyncedAsset('b.jpg');
    const controller = new AbortController();

    const outcome = await runBackup(db, [a.id, b.id], {
      uploads: uploads({
        uploadFile: async (asset) => {
          calls.push(`file ${asset.filename}`);
          controller.abort(); // someone else signs in while the first file uploads
        },
      }),
      controller,
    });

    expect(outcome).toBe('aborted');
    expect(calls).toEqual(['file a.jpg']);
    expect(deleted).toEqual([]);
    expect(await row(a.id)).toMatchObject({ isFileSynced: false, isSynced: false, syncError: null });
    expect(await row(b.id)).toMatchObject({ isFileSynced: false, isSynced: false, syncError: null });
  });

  it('a cancelled upload is not a failure', async () => {
    const a = await unsyncedAsset('a.jpg');
    const controller = new AbortController();

    const outcome = await runBackup(db, [a.id], {
      uploads: uploads({
        uploadFile: async () => {
          controller.abort();
          throw new Error('Upload cancelled');
        },
      }),
      controller,
    });

    expect(outcome).toBe('aborted');
    expect(await row(a.id)).toMatchObject({ isFileSynced: false, syncError: null });
  });

  it('stops before the thumbnail upload and before the next asset', async () => {
    const a = await unsyncedAsset('a.jpg');
    const controller = new AbortController();

    const outcome = await runBackup(db, [a.id], {
      uploads: uploads({
        deleteFile: async (filename) => {
          deleted.push(filename);
          controller.abort();
        },
      }),
      controller,
    });

    expect(outcome).toBe('aborted');
    expect(calls).toEqual(['file a.jpg']);
    expect(await row(a.id)).toMatchObject({ isFileSynced: true, isThumbnailSynced: false, isSynced: false });
  });
});
