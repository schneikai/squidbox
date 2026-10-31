import { PUSH_BODY_LIMIT, PUSH_MAX_MUTATIONS, type PushMutation } from '@squidbox/shared';
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
  it('create writes the row and one outbox row; the row reads back', async () => {
    const rec = await repo.create(db, makeAssetRecord({ filename: 'x.jpg' }));
    expect(await readLiveAsset(db, rec.id)).toMatchObject({ id: rec.id, filename: 'x.jpg' });
    const ob = await outboxRows();
    expect(ob).toHaveLength(1);
    expect(ob[0]).toMatchObject({ collection: 'assets', recordId: rec.id, op: 'upsert' });
  });

  it('update bumps updatedAt monotonically and coalesces the outbox to one row', async () => {
    const rec = await repo.create(db, makeAssetRecord({ updatedAt: 1000 }));
    await repo.update(db, rec.id, { isFavorite: true });
    await repo.update(db, rec.id, { notes: 'hi' });
    const row = await assetRow(rec.id);
    expect(row?.isFavorite).toBe(true);
    expect(row?.notes).toBe('hi');
    expect(row!.updatedAt).toBeGreaterThan(1000);
    expect(await outboxRows()).toHaveLength(1); // coalesced
  });

  it('two toggles in flight together leave the favorite as it was', async () => {
    const rec = await repo.create(db, makeAssetRecord({ isFavorite: false }));
    await Promise.all([repo.toggleFavorite(db, rec.id), repo.toggleFavorite(db, rec.id)]);
    expect((await assetRow(rec.id))?.isFavorite).toBe(false);
  });

  it('a favoriting records when, an unfavoriting clears it', async () => {
    const rec = await repo.create(db, makeAssetRecord({ isFavorite: false }));
    await repo.toggleFavorite(db, rec.id);
    const favorited = await assetRow(rec.id);
    expect(favorited?.favoritedAt).toBe(favorited!.updatedAt);
    await repo.toggleFavorite(db, rec.id);
    expect((await assetRow(rec.id))?.favoritedAt).toBeNull();
  });

  it('remove tombstones (excluded from the live map) and enqueues a delete', async () => {
    const rec = await repo.create(db, makeAssetRecord());
    await repo.remove(db, [rec.id]);
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
    const rec = await repo.create(db, makeAssetRecord());
    expect(await fieldsOf(rec.id)).toMatchObject({
      notes: rec.updatedAt,
      deletedAt: rec.updatedAt,
      isFileSynced: rec.updatedAt,
    });
    expect(await fieldsOf(rec.id)).not.toHaveProperty('updatedAt');
  });

  it('an update, a toggle, a delete and a purge name only what they change', async () => {
    const rec = await repo.create(db, makeAssetRecord({ notes: 'same' }));
    await settled();

    await repo.update(db, rec.id, { notes: 'same', filename: 'b.jpg' }); // the whole form, one change
    expect(await fieldsOf(rec.id)).toEqual({ filename: (await assetRow(rec.id))!.updatedAt });
    await settled();

    await repo.toggleFavorite(db, rec.id);
    const favoritedAt = (await assetRow(rec.id))!.updatedAt;
    expect(await fieldsOf(rec.id)).toEqual({ isFavorite: favoritedAt, favoritedAt });
    await settled();

    await repo.remove(db, [rec.id]);
    const deletedAt = (await assetRow(rec.id))!.updatedAt;
    expect(await fieldsOf(rec.id)).toEqual({ deletedAt, purgedAt: deletedAt }); // one field group
    await settled();

    await repo.purgeAssets(db, [rec.id]);
    const purgedAt = (await assetRow(rec.id))!.updatedAt;
    expect(await fieldsOf(rec.id)).toEqual({ deletedAt: purgedAt, purgedAt });
  });

  it('coalesced edits keep each field’s own clock, the payload the latest record', async () => {
    const rec = await repo.create(db, makeAssetRecord());
    await settled();
    await repo.update(db, rec.id, { notes: 'first' });
    const first = (await assetRow(rec.id))!.updatedAt;
    await repo.update(db, rec.id, { isFavorite: true });
    const second = (await assetRow(rec.id))!.updatedAt;
    await repo.update(db, rec.id, { notes: 'again' });
    const third = (await assetRow(rec.id))!.updatedAt;

    const [row] = await outboxRows();
    expect(row?.fields).toEqual({ isFavorite: second, favoritedAt: second, notes: third }); // one field group
    expect(second).toBeGreaterThan(first);
    expect(row?.payload).toMatchObject({ notes: 'again', isFavorite: true, updatedAt: third });
  });

  it('a save that changes nothing writes nothing', async () => {
    const rec = await repo.create(db, makeAssetRecord({ notes: 'same' }));
    await settled();
    const before = await assetRow(rec.id);
    await repo.update(db, rec.id, { notes: 'same' });
    expect(await assetRow(rec.id)).toEqual(before);
    expect(await outboxRows()).toHaveLength(0);
  });

  it('the file flags are sent together', async () => {
    const rec = await repo.create(
      db,
      makeAssetRecord({ isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await settled();
    await repo.update(db, rec.id, { isThumbnailSynced: true });
    const ts = (await assetRow(rec.id))!.updatedAt;
    expect(await fieldsOf(rec.id)).toEqual({ isFileSynced: ts, isThumbnailSynced: ts, isSynced: ts });
  });

  it('the push sends the fields', async () => {
    const edited = await repo.create(db, makeAssetRecord());
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
  });
});

describe('worker push', () => {
  it('drains the outbox when everything is applied', async () => {
    await repo.create(db, makeAssetRecord());
    await repo.create(db, makeAssetRecord());
    await runSyncOnce(db, fakeTransport());
    expect(await outboxRows()).toHaveLength(0);
  });

  it('splits a push by size too: no request carries more than half the body limit of mutations, each row is pushed once', async () => {
    const notes = 'é'.repeat(PUSH_BODY_LIMIT / 16); // an eighth of the limit in UTF-8
    const records = Array.from({ length: 12 }, () => makeAssetRecord({ notes }));
    await repo.createMany(db, records);
    const sizes: number[] = [];
    const ids: string[] = [];
    const counting = fakeTransport({
      push: async (req) => {
        sizes.push(new TextEncoder().encode(JSON.stringify(req.mutations)).length);
        ids.push(...req.mutations.map((m) => String(m.record.id)));
        return fakeTransport().push(req);
      },
    });
    await runSyncOnce(db, counting);
    expect(sizes.length).toBeGreaterThan(2);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(PUSH_BODY_LIMIT / 2);
    expect(ids.sort()).toEqual(records.map((r) => r.id).sort());
    expect(await outboxRows()).toHaveLength(0);
  });

  // A transport with the server's real limits: at most PUSH_MAX_MUTATIONS mutations, and a
  // request body (`{"mutations":[…]}` in UTF-8) of at most PUSH_BODY_LIMIT, else Fastify answers 413
  // before the handler (test/routes.sync.test.ts in apps/server), which fails the request whole.
  function serverLimits(sentBodies: number[] = []) {
    return fakeTransport({
      push: async (req) => {
        const body = new TextEncoder().encode(JSON.stringify(req)).length;
        sentBodies.push(body);
        if (req.mutations.length > PUSH_MAX_MUTATIONS) throw new Error('400: too many mutations');
        if (body > PUSH_BODY_LIMIT) throw new Error('Request failed with status code 413');
        return fakeTransport().push(req);
      },
    });
  }

  it('by count and by bytes at once: more small rows than a request takes, one over half the limit and 4-byte emoji, none refused', async () => {
    const small = Array.from({ length: PUSH_MAX_MUTATIONS * 2 + 200 }, (_, i) => makeAssetRecord({ notes: `😀${i}` }));
    // 0.6 of the limit in UTF-8 (4 bytes, 2 UTF-16 units each), and three of 0.3 (3 bytes, 1 unit each).
    const big = makeAssetRecord({ notes: '😀'.repeat(Math.floor((0.6 * PUSH_BODY_LIMIT) / 4)) });
    const mid = Array.from({ length: 3 }, () =>
      makeAssetRecord({ notes: '中'.repeat(Math.floor((0.3 * PUSH_BODY_LIMIT) / 3)) }),
    );
    await repo.createMany(db, small.slice(0, small.length / 2));
    await repo.createMany(db, [big, ...mid]);
    await repo.createMany(db, small.slice(small.length / 2));
    const bodies: number[] = [];
    await runSyncOnce(db, serverLimits(bodies));
    expect(await outboxRows()).toHaveLength(0);
    expect(Math.max(...bodies)).toBeLessThanOrEqual(PUSH_BODY_LIMIT);
    // A request over half the limit is one row alone (the big one).
    expect(bodies.filter((b) => b > PUSH_BODY_LIMIT / 2 + 1024)).toHaveLength(1);
  });

  // A single row over the server's body limit (a post or a note with ~1 MB of text; no schema bounds
  // a text field) would be refused with a 413 on every run, failing the request whole. It is never
  // sent: it gets a too-large rejection, as a row the server refused does (an `error` on its outbox
  // row, shown like a rejected push), and the other rows and the pull go on.
  it('a single row over the body limit fails alone; the other rows and the pull go on', async () => {
    const huge = await repo.create(db, makeAssetRecord({ notes: 'é'.repeat(Math.floor(0.6 * PUSH_BODY_LIMIT)) })); // 1.2x
    await repo.create(db, makeAssetRecord({ notes: 'small' }));
    let pulls = 0;
    const limits = serverLimits();
    const transport = fakeTransport({
      push: limits.push,
      pull: async (req) => {
        pulls += 1;
        return limits.pull(req);
      },
    });
    for (let run = 0; run < 3; run++) await runSyncOnce(db, transport).catch(() => {});
    const waiting = await outboxRows();
    expect(waiting.map((row) => row.recordId)).toEqual([huge.id]); // `other` pushed
    expect(waiting[0]!.error).not.toBeNull(); // the oversize row shows as failed
    expect(pulls).toBeGreaterThan(0); // and the pull ran
  });

  it('an applied push changes no asset row, so live reads of assets are not re-run', async () => {
    await repo.create(db, makeAssetRecord());
    const changed: string[] = [];
    (db as AppDb).onTablesChanged((tables) => changed.push(...tables));
    await runSyncOnce(db, fakeTransport());
    expect(changed).not.toContain('assets');
  });

  it('adopts the server current on skipped-lww and clears the outbox', async () => {
    const rec = await repo.create(db, makeAssetRecord({ notes: 'mine', updatedAt: 1000 }));
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
    const [log] = await db.select().from(schema.syncLog);
    expect(log?.notes).toBe(`assets ${rec.id}: notes overwritten by server`); // names what was lost
  });

  it('keeps the outbox row on rejected and records the reason there, not as an upload error', async () => {
    const rec = await repo.create(db, makeAssetRecord());
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
    const bad = await repo.create(db, makeAssetRecord());
    const good = await repo.create(db, makeAssetRecord());
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
    const rec = await repo.create(db, makeAssetRecord({ notes: 'local' }));
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

  // A server that keeps every push pending (rejected) and delivers `record` on pull.
  const pendingAndPulling = (record: Record<string, unknown>) =>
    fakeTransport({
      push: async (req) => ({
        results: req.mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          status: 'rejected' as const,
          reason: 'x',
        })),
      }),
      pull: async () => ({ changes: { assets: { records: [record] } }, cursor: 7, hasMore: false }),
    });

  it('a pulled record with a pending edit takes every field but the ones that edit changed', async () => {
    const rec = await repo.create(db, makeAssetRecord());
    await runSyncOnce(db, fakeTransport());
    await repo.update(db, rec.id, { notes: 'local' });
    const local = await assetRow(rec.id);
    const incoming = makeAssetRecord({
      id: rec.id,
      notes: 'server',
      isFavorite: true,
      updatedAt: local!.updatedAt + 9,
    });
    await runSyncOnce(db, pendingAndPulling(incoming as unknown as Record<string, unknown>));
    expect(await assetRow(rec.id)).toMatchObject({ notes: 'local', isFavorite: true, updatedAt: incoming.updatedAt });
  });

  it('an edit right after the pull of a newer field gets a clock above it', async () => {
    const rec = await repo.create(db, makeAssetRecord());
    await runSyncOnce(db, fakeTransport());
    await repo.update(db, rec.id, { filename: 'renamed.jpg' }); // pending
    const pulledAt = Date.now() + 60_000; // another device's clock runs ahead
    const incoming = makeAssetRecord({ id: rec.id, notes: 'from the other device', updatedAt: pulledAt });
    await runSyncOnce(db, pendingAndPulling(incoming as unknown as Record<string, unknown>));
    await repo.update(db, rec.id, { notes: 'edited here after' });
    const [row] = await outboxRows();
    expect(row!.fields.notes).toBeGreaterThan(pulledAt);
    expect(await assetRow(rec.id)).toMatchObject({ filename: 'renamed.jpg', notes: 'edited here after' });
  });

  it('a pending purge keeps the asset deleted when a restore is pulled', async () => {
    const rec = await repo.create(db, makeAssetRecord());
    await repo.remove(db, [rec.id]);
    await runSyncOnce(db, fakeTransport());
    await repo.purgeAssets(db, [rec.id]); // pending: { purgedAt }
    const restored = makeAssetRecord({ id: rec.id, deletedAt: null, updatedAt: Date.now() + 60_000 });
    await runSyncOnce(db, pendingAndPulling({ ...restored, purgedAt: null } as unknown as Record<string, unknown>));
    const row = await assetRow(rec.id);
    expect(row!.purgedAt).not.toBeNull();
    expect(row!.deletedAt).not.toBeNull();
  });

  it('keeps a local column the incoming record does not carry', async () => {
    const rec = await repo.create(db, makeAssetRecord({ notes: 'mine' }));
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
