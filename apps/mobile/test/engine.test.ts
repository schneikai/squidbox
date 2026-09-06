import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PullResponse, PushRequest, PushResponse } from '@squidbox/shared';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import type { SyncTransport } from '../src/sync/transport';
import * as repo from '../src/sync/assetsRepository';
import { runSyncOnce } from '../src/sync/worker';
import { getCursor } from '../src/sync/status';
import { makeTestDb } from './helpers/testDb';
import { makeAssetRecord } from './helpers/factory';

let db: SyncDb;
beforeEach(() => {
  db = makeTestDb();
});

const outboxRows = () => db.select().from(schema.outbox).all();
const assetRow = (id: string) => db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();

// Configurable fake transport.
function transport(over: Partial<SyncTransport> = {}): SyncTransport {
  return {
    push: async (req: PushRequest): Promise<PushResponse> => ({
      results: req.mutations.map((m) => ({ id: String((m.record as any).id), collection: m.collection, status: 'applied' as const })),
    }),
    pull: async (): Promise<PullResponse> => ({ changes: { assets: { records: [] } }, cursor: 0, hasMore: false }),
    ...over,
  };
}

describe('repository (real SQLite)', () => {
  it('createAsset writes the row and one outbox row; loadAssetsMap returns it', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ filename: 'x.jpg' }));
    const map = await repo.loadAssetsMap(db);
    expect(map[rec.id]).toMatchObject({ id: rec.id, filename: 'x.jpg' });
    const ob = await outboxRows();
    expect(ob).toHaveLength(1);
    expect(ob[0]).toMatchObject({ collection: 'assets', recordId: rec.id, op: 'upsert' });
  });

  it('updateAsset bumps updatedAt monotonically and coalesces the outbox to one row', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ updatedAt: 1000 }));
    await repo.updateAsset(db, rec.id, { isFavorite: true });
    await repo.updateAsset(db, rec.id, { notes: 'hi' });
    const row = await assetRow(rec.id);
    expect(row?.isFavorite).toBe(true);
    expect(row?.notes).toBe('hi');
    expect(row!.updatedAt).toBeGreaterThan(1000);
    expect(await outboxRows()).toHaveLength(1); // coalesced
  });

  it('deleteAssets tombstones (excluded from the live map) and enqueues a delete', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord());
    await repo.deleteAssets(db, [rec.id]);
    expect((await repo.loadAssetsMap(db))[rec.id]).toBeUndefined();
    const row = await assetRow(rec.id);
    expect(row?.deletedAt).not.toBeNull();
    const ob = await outboxRows();
    expect(ob[0]).toMatchObject({ op: 'delete' });
  });
});

describe('worker push', () => {
  it('drains the outbox when everything is applied', async () => {
    await repo.createAsset(db, makeAssetRecord());
    await repo.createAsset(db, makeAssetRecord());
    await runSyncOnce(db, transport());
    expect(await outboxRows()).toHaveLength(0);
  });

  it('adopts the server current on skipped-lww and clears the outbox', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ notes: 'mine', updatedAt: 1000 }));
    const serverWins = makeAssetRecord({ id: rec.id, notes: 'server', updatedAt: 5000 });
    await runSyncOnce(
      db,
      transport({
        push: async (req) => ({
          results: req.mutations.map((m) => ({
            id: String((m.record as any).id),
            collection: m.collection,
            status: 'skipped-lww' as const,
            current: serverWins as unknown as Record<string, unknown>,
          })),
        }),
      }),
    );
    expect(await outboxRows()).toHaveLength(0);
    expect((await assetRow(rec.id))?.notes).toBe('server'); // adopted the winner
  });

  it('keeps the outbox row and flags syncError on rejected', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord());
    await runSyncOnce(
      db,
      transport({
        push: async (req) => ({
          results: req.mutations.map((m) => ({
            id: String((m.record as any).id),
            collection: m.collection,
            status: 'rejected' as const,
            reason: 'schema:boom',
          })),
        }),
        pull: async () => ({ changes: { assets: { records: [] } }, cursor: 0, hasMore: false }),
      }),
    );
    expect(await outboxRows()).toHaveLength(1); // not silently dropped
    expect((await assetRow(rec.id))?.syncError).toBe('schema:boom');
  });
});

describe('worker pull', () => {
  it('applies incoming records and advances the cursor', async () => {
    const incoming = makeAssetRecord({ filename: 'pulled.jpg' });
    await runSyncOnce(
      db,
      transport({
        pull: async () => ({
          changes: { assets: { records: [incoming as unknown as Record<string, unknown>] } },
          cursor: 42,
          hasMore: false,
        }),
      }),
    );
    expect((await repo.loadAssetsMap(db))[incoming.id]).toMatchObject({ filename: 'pulled.jpg' });
    expect(await getCursor(db)).toBe(42);
  });

  it('is outbox-guarded: a pulled record with a pending local edit is NOT overwritten', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ notes: 'local' }));
    const stale = makeAssetRecord({ id: rec.id, notes: 'stale-from-server' });
    await runSyncOnce(
      db,
      transport({
        // push rejected → outbox row stays pending for rec.id
        push: async (req) => ({
          results: req.mutations.map((m) => ({ id: String((m.record as any).id), collection: m.collection, status: 'rejected' as const, reason: 'x' })),
        }),
        pull: async () => ({
          changes: { assets: { records: [stale as unknown as Record<string, unknown>] } },
          cursor: 7,
          hasMore: false,
        }),
      }),
    );
    expect((await assetRow(rec.id))?.notes).toBe('local'); // local edit preserved
  });
});
