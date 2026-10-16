import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { fakeTransport } from './helpers/fakeTransport';
import { readLiveAsset } from './helpers/readLiveAsset';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { getCursor } from '../src/sync/status';
import { runSyncOnce } from '../src/sync/worker';

let db: SyncDb;
beforeEach(() => {
  db = makeTestDb();
});

const outboxRows = () => db.select().from(schema.outbox);
const assetRow = (id: string) => db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();

describe('repository (real SQLite)', () => {
  it('createAsset writes the row and one outbox row; the row reads back', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ filename: 'x.jpg' }));
    expect(await readLiveAsset(db, rec.id)).toMatchObject({ id: rec.id, filename: 'x.jpg' });
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

  it('two toggles in flight together leave the favorite as it was', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ isFavorite: false }));
    await Promise.all([repo.toggleFavorite(db, rec.id), repo.toggleFavorite(db, rec.id)]);
    expect((await assetRow(rec.id))?.isFavorite).toBe(false);
  });

  it('deleteAssets tombstones (excluded from the live map) and enqueues a delete', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord());
    await repo.deleteAssets(db, [rec.id]);
    expect(await readLiveAsset(db, rec.id)).toBeUndefined();
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
    await runSyncOnce(db, fakeTransport());
    expect(await outboxRows()).toHaveLength(0);
  });

  it('an applied push changes no asset row, so live reads of assets are not re-run', async () => {
    await repo.createAsset(db, makeAssetRecord());
    const changed: string[] = [];
    (db as AppDb).onTablesChanged((tables) => changed.push(...tables));
    await runSyncOnce(db, fakeTransport());
    expect(changed).not.toContain('assets');
  });

  it('adopts the server current on skipped-lww and clears the outbox', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ notes: 'mine', updatedAt: 1000 }));
    const serverWins = makeAssetRecord({ id: rec.id, notes: 'server', updatedAt: 5000 });
    await runSyncOnce(
      db,
      fakeTransport({
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
      fakeTransport({
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

  it('a push result that cannot be applied is flagged alone; the rest of the batch and the pull go on', async () => {
    const bad = await repo.createAsset(db, makeAssetRecord());
    const good = await repo.createAsset(db, makeAssetRecord());
    await runSyncOnce(
      db,
      fakeTransport({
        push: async () => ({
          results: [
            // A malformed `current` (missing required columns) can't be stored.
            { id: bad.id, collection: 'assets', status: 'skipped-lww' as const, current: { id: bad.id } },
            { id: good.id, collection: 'assets', status: 'applied' as const },
          ],
        }),
        pull: async () => ({ changes: { assets: { records: [] } }, cursor: 9, hasMore: false }),
      }),
    );
    expect((await outboxRows()).map((row) => row.recordId)).toEqual([bad.id]); // kept for the next push
    expect((await assetRow(bad.id))?.syncError).toBeTruthy();
    expect((await assetRow(good.id))?.syncError).toBeNull();
    expect(await getCursor(db)).toBe(9);
    const [log] = await db.select().from(schema.syncLog);
    expect(log?.notes).toContain(`assets ${bad.id}: push result not applied`);
  });
});

describe('worker pull', () => {
  it('applies incoming records and advances the cursor', async () => {
    const incoming = makeAssetRecord({ filename: 'pulled.jpg' });
    await runSyncOnce(
      db,
      fakeTransport({
        pull: async () => ({
          changes: { assets: { records: [incoming as unknown as Record<string, unknown>] } },
          cursor: 42,
          hasMore: false,
        }),
      }),
    );
    expect(await readLiveAsset(db, incoming.id)).toMatchObject({ filename: 'pulled.jpg' });
    expect(await getCursor(db)).toBe(42);
  });

  it('is outbox-guarded: a pulled record with a pending local edit is NOT overwritten', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ notes: 'local' }));
    const stale = makeAssetRecord({ id: rec.id, notes: 'stale-from-server' });
    await runSyncOnce(
      db,
      fakeTransport({
        // push rejected → outbox row stays pending for rec.id
        push: async (req) => ({
          results: req.mutations.map((m) => ({
            id: String((m.record as any).id),
            collection: m.collection,
            status: 'rejected' as const,
            reason: 'x',
          })),
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

  it('keeps a local column the incoming record does not carry', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ notes: 'mine' }));
    await runSyncOnce(db, fakeTransport()); // pushed and settled
    const { notes: _notes, ...withoutNotes } = makeAssetRecord({
      id: rec.id,
      filename: 'renamed.jpg',
      updatedAt: 9000,
    });
    await runSyncOnce(
      db,
      fakeTransport({
        pull: async () => ({ changes: { assets: { records: [withoutNotes] } }, cursor: 1, hasMore: false }),
      }),
    );
    expect(await assetRow(rec.id)).toMatchObject({ filename: 'renamed.jpg', notes: 'mine' });
  });
});
