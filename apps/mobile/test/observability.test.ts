import { describe, it, expect, beforeEach } from 'vitest';
import { desc } from 'drizzle-orm';
import type { PushRequest, PushResponse, PullResponse } from '@squidbox/shared';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import type { SyncTransport } from '../src/sync/transport';
import * as repo from '../src/sync/assetsRepository';
import { runSyncOnce, clearOutbox, fullResync } from '../src/sync/worker';
import { makeTestDb } from './helpers/testDb';
import { makeAssetRecord } from './helpers/factory';

let db: SyncDb;
beforeEach(() => {
  db = makeTestDb();
});

const appliedTransport = (): SyncTransport => ({
  push: async (req: PushRequest): Promise<PushResponse> => ({
    results: req.mutations.map((m) => ({ id: String((m.record as any).id), collection: m.collection, status: 'applied' as const })),
  }),
  pull: async (): Promise<PullResponse> => ({ changes: { assets: { records: [] } }, cursor: 0, hasMore: false }),
});

const lastLog = () => db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(1).get();

describe('sync_log observability', () => {
  it('writes a log row with push/pull counts after each run', async () => {
    await repo.createAsset(db, makeAssetRecord());
    await runSyncOnce(db, appliedTransport());
    const row = await lastLog();
    expect(row).toBeTruthy();
    expect(row!.pushed).toBe(1);
    expect(row!.error).toBeNull();
  });

  it('records a conflict note when a local change loses LWW (skipped-lww)', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ notes: 'mine' }));
    const serverWins = makeAssetRecord({ id: rec.id, notes: 'server', updatedAt: 9999 });
    await runSyncOnce(db, {
      push: async (req) => ({
        results: req.mutations.map((m) => ({
          id: String((m.record as any).id),
          collection: m.collection,
          status: 'skipped-lww' as const,
          current: serverWins as unknown as Record<string, unknown>,
        })),
      }),
      pull: async () => ({ changes: { assets: { records: [] } }, cursor: 0, hasMore: false }),
    });
    const row = await lastLog();
    expect(row!.notes).toContain('overwritten by server');
  });

  it('records an error in the log when a phase throws', async () => {
    await repo.createAsset(db, makeAssetRecord());
    await expect(
      runSyncOnce(db, {
        push: async () => {
          throw new Error('network down');
        },
        pull: async () => ({ changes: { assets: { records: [] } }, cursor: 0, hasMore: false }),
      }),
    ).rejects.toThrow('network down');
    const row = await lastLog();
    expect(row!.error).toContain('network down');
  });
});

describe('dev operations', () => {
  it('clearOutbox empties the outbox', async () => {
    await repo.createAsset(db, makeAssetRecord());
    expect(await db.select().from(schema.outbox)).toHaveLength(1);
    await clearOutbox(db);
    expect(await db.select().from(schema.outbox)).toHaveLength(0);
  });

  it('fullResync wipes local tables and repulls from the server', async () => {
    const local = await repo.createAsset(db, makeAssetRecord({ notes: 'local-only' }));
    const server = makeAssetRecord({ notes: 'from-server' });
    await fullResync(db, {
      push: async (req) => ({
        results: req.mutations.map((m) => ({ id: String((m.record as any).id), collection: m.collection, status: 'applied' as const })),
      }),
      pull: async () => ({ changes: { assets: { records: [server as unknown as Record<string, unknown>] } }, cursor: 12, hasMore: false }),
    });
    const map = await repo.loadAssetsMap(db);
    expect(map[server.id]).toBeTruthy(); // repulled
    expect(map[local.id]).toBeUndefined(); // wiped, not returned by the server pull
  });
});
