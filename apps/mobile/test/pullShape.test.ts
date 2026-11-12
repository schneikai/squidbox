import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { fakeTransport } from './helpers/fakeTransport';
import { lastSyncLog } from './helpers/lastSyncLog';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import { pulledShape } from '../src/sync/clientCollections';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { getCursor, pullCursor, setCursor } from '../src/sync/status';
import type { SyncTransport } from '../src/sync/transport';
import { runSyncOnce } from '../src/sync/worker';

let db: AppDb;
beforeEach(() => {
  db = makeTestDb();
});

// A server whose pulls end at `end`, recording the cursors asked for.
function recordingServer(end: number, records: Record<string, unknown>[] = []) {
  const asked: number[] = [];
  const transport: SyncTransport = fakeTransport({
    pull: async ({ cursor }) => {
      asked.push(cursor);
      return { changes: { assets: { records } }, cursor: end, hasMore: false };
    },
  });
  return { asked, transport };
}

const lastNotes = async () => (await lastSyncLog(db))?.notes ?? null;

describe('a pull restarts when the app learns new collections or fields', () => {
  it('a database without a stored shape and no cursor pulls from the start, stores the shape, notes nothing', async () => {
    const { asked, transport } = recordingServer(5);
    await runSyncOnce(db, transport);
    expect(asked).toEqual([0]);
    expect(await pullCursor(db, pulledShape())).toEqual({ cursor: 5, newFields: null });
    expect(await lastNotes()).toBeNull();
  });

  it('a database from before the shape was kept pulls from the start once, with the note', async () => {
    await setCursor(db, 40);
    const { asked, transport } = recordingServer(50);
    await runSyncOnce(db, transport);
    expect(await lastNotes()).toMatch(/^pull restarted from the beginning: new synced fields or collections \(/);
    await runSyncOnce(db, transport);
    expect(asked).toEqual([0, 50]);
    expect(await lastNotes()).toBeNull();
  });

  it('the stored shape pulls from the stored cursor, writing nothing', async () => {
    await pullCursor(db, pulledShape());
    await setCursor(db, 30);
    const written: string[][] = [];
    db.onTablesChanged((tables) => written.push([...tables]));
    expect(await pullCursor(db, pulledShape())).toEqual({ cursor: 30, newFields: null });
    expect(written).toEqual([]);
  });

  it('another stored shape pulls from the start once, naming what is new, then from the new cursor', async () => {
    await pullCursor(db, { ...pulledShape(), assets: pulledShape().assets!.filter((column) => column !== 'tags') });
    await setCursor(db, 30);
    const { asked, transport } = recordingServer(60);
    await runSyncOnce(db, transport);
    expect(await lastNotes()).toBe('pull restarted from the beginning: new synced fields or collections (assets.tags)');
    await runSyncOnce(db, transport);
    expect(asked).toEqual([0, 60]);
    expect(await getCursor(db)).toBe(60);
  });

  it('a shape that only lost a column keeps the cursor and notes nothing', async () => {
    await pullCursor(db, { ...pulledShape(), assets: [...pulledShape().assets!, 'retired_column'] });
    await setCursor(db, 30);
    const { asked, transport } = recordingServer(60);
    await runSyncOnce(db, transport);
    expect(asked).toEqual([30]);
    expect(await lastNotes()).toBeNull();
  });

  it('a restarted pull that fails still notes the restart', async () => {
    await pullCursor(db, { ...pulledShape(), assets: pulledShape().assets!.filter((column) => column !== 'tags') });
    await setCursor(db, 30);
    const offline = fakeTransport({
      pull: async () => {
        throw new Error('offline');
      },
    });
    await expect(runSyncOnce(db, offline)).rejects.toThrow('offline');
    expect(await lastNotes()).toMatch(/^pull restarted from the beginning: .*\(assets\.tags\)$/);
  });

  it("a pending edit's fields survive the re-pull", async () => {
    const asset = await repo.create(db, makeAssetRecord({ notes: 'server' }));
    await db.delete(schema.outbox);
    await repo.update(db, asset.id, { notes: 'mine' });
    await pullCursor(db, { assets: ['id'] });
    await setCursor(db, 30);
    const pulled = { ...makeAssetRecord({ id: asset.id, notes: 'server', updatedAt: 1 }), tags: ['x'] };
    const { transport } = recordingServer(60, [pulled]);
    await runSyncOnce(db, fakeTransport({ pull: transport.pull, push: async () => ({ results: [] }) }));
    const row = await db.select().from(schema.assets).where(eq(schema.assets.id, asset.id)).get();
    expect(row).toMatchObject({ notes: 'mine', tags: ['x'] });
  });
});
