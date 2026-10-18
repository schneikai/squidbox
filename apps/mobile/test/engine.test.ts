import type { PushMutation } from '@squidbox/shared';
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

describe('outbox fields (per-field merge)', () => {
  const fieldsOf = async (id: string) => (await outboxRows()).find((row) => row.recordId === id)?.fields;
  const settled = async () => {
    await runSyncOnce(db, fakeTransport());
    expect(await outboxRows()).toHaveLength(0);
  };

  it('a create names every field at its clock', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord());
    expect(await fieldsOf(rec.id)).toMatchObject({
      notes: rec.updatedAt,
      deletedAt: rec.updatedAt,
      isFileSynced: rec.updatedAt,
    });
    expect(await fieldsOf(rec.id)).not.toHaveProperty('updatedAt');
  });

  it('an update, a toggle, a delete and a purge name only what they change', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ notes: 'same' }));
    await settled();

    await repo.updateAsset(db, rec.id, { notes: 'same', filename: 'b.jpg' }); // the whole form, one change
    expect(await fieldsOf(rec.id)).toEqual({ filename: (await assetRow(rec.id))!.updatedAt });
    await settled();

    await repo.toggleFavorite(db, rec.id);
    expect(await fieldsOf(rec.id)).toEqual({ isFavorite: (await assetRow(rec.id))!.updatedAt });
    await settled();

    await repo.deleteAssets(db, [rec.id]);
    expect(await fieldsOf(rec.id)).toEqual({ deletedAt: (await assetRow(rec.id))!.updatedAt });
    await settled();

    await repo.purgeAssets(db, [rec.id], async () => {});
    expect(await fieldsOf(rec.id)).toEqual({ purgedAt: (await assetRow(rec.id))!.updatedAt });
  });

  it('coalesced edits keep each field’s own clock, the payload the latest record', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord());
    await settled();
    await repo.updateAsset(db, rec.id, { notes: 'first' });
    const first = (await assetRow(rec.id))!.updatedAt;
    await repo.updateAsset(db, rec.id, { isFavorite: true });
    const second = (await assetRow(rec.id))!.updatedAt;
    await repo.updateAsset(db, rec.id, { notes: 'again' });
    const third = (await assetRow(rec.id))!.updatedAt;

    const [row] = await outboxRows();
    expect(row?.fields).toEqual({ isFavorite: second, notes: third });
    expect(second).toBeGreaterThan(first);
    expect(row?.payload).toMatchObject({ notes: 'again', isFavorite: true, updatedAt: third });
  });

  it('a save that changes nothing writes nothing', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord({ notes: 'same' }));
    await settled();
    const before = await assetRow(rec.id);
    await repo.updateAsset(db, rec.id, { notes: 'same' });
    expect(await assetRow(rec.id)).toEqual(before);
    expect(await outboxRows()).toHaveLength(0);
  });

  it('the file flags are sent together', async () => {
    const rec = await repo.createAsset(
      db,
      makeAssetRecord({ isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await settled();
    await repo.updateAsset(db, rec.id, { isThumbnailSynced: true });
    const ts = (await assetRow(rec.id))!.updatedAt;
    expect(await fieldsOf(rec.id)).toEqual({ isFileSynced: ts, isThumbnailSynced: ts, isSynced: ts });
  });

  it('the push sends the fields, and a row enqueued before them as a whole record', async () => {
    const edited = await repo.createAsset(db, makeAssetRecord());
    const legacy = await repo.createAsset(db, makeAssetRecord());
    await db.update(schema.outbox).set({ fields: null }).where(eq(schema.outbox.recordId, legacy.id));
    const sent: PushMutation[] = [];
    await runSyncOnce(
      db,
      fakeTransport({
        push: async (req) => {
          sent.push(...req.mutations);
          return fakeTransport().push(req);
        },
      }),
    );
    expect(sent.find((m) => m.record.id === edited.id)?.fields).toMatchObject({ notes: edited.updatedAt });
    expect(sent.find((m) => m.record.id === legacy.id)?.fields).toBeUndefined();
  });

  it('an edit of a row enqueued before them keeps it a whole record', async () => {
    const rec = await repo.createAsset(db, makeAssetRecord());
    await db.update(schema.outbox).set({ fields: null });
    await repo.updateAsset(db, rec.id, { notes: 'n' });
    expect(await fieldsOf(rec.id)).toBeNull();
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

  it('keeps the outbox row on rejected and records the reason there, not as an upload error', async () => {
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
    expect(await outboxRows()).toMatchObject([{ recordId: rec.id, error: 'schema:boom' }]); // not silently dropped
    expect((await assetRow(rec.id))?.syncError).toBeNull();
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
    expect(await outboxRows()).toMatchObject([{ recordId: bad.id, error: expect.any(String) }]); // kept, with why
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
