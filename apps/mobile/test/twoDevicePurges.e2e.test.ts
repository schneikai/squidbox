import { type PushMutation } from '@squidbox/shared';
import { tick } from '@squidbox/shared/testing/tick';
import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { readLiveAsset } from './helpers/readLiveAsset';
import {
  A,
  B,
  C,
  HOUR,
  S,
  SERVER_NOW,
  USER,
  at,
  edit,
  expectConverged,
  localRow,
  pgDb,
  pullOnly,
  pushLog,
  removedFiles,
  seedAsset,
  serverRow,
  settle,
  sync,
  synced,
  transportOf,
  unansweredTransport,
  useTwoDeviceServer,
} from './helpers/twoDeviceServer';
import * as serverSchema from '../../server/src/db/schema.js';
import { deletePurgedFiles } from '../../server/src/sync/purgedFiles.js';
import * as repo from '../src/sync/assetsRepository';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { retryFailures } from '../src/sync/outbox';
import type { SyncTransport } from '../src/sync/transport';
import { runSyncOnce } from '../src/sync/worker';

// Deletes, restores and purges across devices, and the server's cleanup of purged files. Devices A,
// B and a whole-record app C run against the real server engine on Postgres (helpers/twoDeviceServer).

describe('deletes, restores and purges across devices', () => {
  useTwoDeviceServer();

  it('an edit of another field doesn’t undelete, older or newer, in either push order', async () => {
    for (const [notesAt, order] of [
      [S + 50, [A, B]],
      [S + 200, [A, B]],
      [S + 200, [B, A]],
    ] as const) {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.remove(A, [id]));
      await edit(B, notesAt, () => repo.update(B, id, { notes: 'B notes' }));
      await sync(order[0]);
      await sync(order[1]);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'B notes', deletedAt: S + 100 });
    }
  });

  it('a restore beats an older delete pushed after it', async () => {
    const id = await seedAsset();
    await edit(B, S + 100, () => repo.remove(B, [id]));
    await sync(B);
    await edit(B, S + 300, () => repo.updateAll(B, [id], { deletedAt: null }));
    await sync(B);
    await edit(A, S + 200, () => repo.remove(A, [id])); // A never saw either, its delete is older
    await settle();
    expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null });
  });

  it('a delete newer than a restore wins over it', async () => {
    const id = await seedAsset();
    await edit(B, S + 100, () => repo.remove(B, [id]));
    await sync(B);
    await edit(B, S + 200, () => repo.updateAll(B, [id], { deletedAt: null }));
    await sync(B);
    await edit(A, S + 300, () => repo.remove(A, [id]));
    await settle();
    expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 300 });
  });

  it('a purge vs a concurrent edit in the Deleted album: the purge is final either way, and an edit pushed first stays in it', async () => {
    for (const purgeFirst of [true, false]) {
      const id = await seedAsset({ notes: 'orig' });
      await edit(A, S + 100, () => repo.remove(A, [id]));
      await settle();
      await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
      await edit(B, S + 300, () => repo.update(B, id, { notes: 'B, newer' }));
      const { removed, removeFiles } = removedFiles({ thumbnails: false });
      if (purgeFirst) {
        await sync(A);
        await sync(B, { removeFiles });
      } else {
        await sync(B);
        await sync(A);
        await sync(B, { removeFiles });
      }
      await settle();
      const row = await expectConverged('assets', id);
      expect(row).toMatchObject({ deletedAt: S + 100, purgedAt: S + 200, notes: purgeFirst ? 'orig' : 'B, newer' });
      expect(removed).toEqual(['a.jpg']);
    }
  });

  // A purge is irreversible: against a restore it hadn't seen, the restore wins whatever the clocks,
  // and the purging device keeps its files and gets the asset back.
  it('a purge and a restore it hadn’t seen: the restore wins in either order, the files stay', async () => {
    for (const purgeLater of [true, false]) {
      const id = await seedAsset();
      await edit(B, S + 100, () => repo.remove(B, [id]));
      await settle();
      await edit(B, purgeLater ? S + 200 : S + 400, () => repo.updateAll(B, [id], { deletedAt: null }));
      await sync(B);
      await edit(A, S + 300, () => repo.purgeAssets(A, [id]));
      const { removed, removeFiles } = removedFiles();
      await sync(A, { removeFiles }); // the purge loses: A gets the asset back, its files never went
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
      expect(removed).toEqual([]);
    }
  });

  // A's deletion is its own, never on the server, so it isn't one B's restore undid: the pair goes by
  // clock (a restore beats only a purge of the deletion it undid, sync-design §7).
  it('an offline delete and purge coalesced in one push go by clock against a restore of another deletion', async () => {
    const id = await seedAsset();
    await edit(B, S + 100, () => repo.remove(B, [id]));
    await sync(B);
    await edit(B, S + 300, () => repo.updateAll(B, [id], { deletedAt: null }));
    await sync(B);
    await edit(A, S + 200, () => repo.remove(A, [id])); // A saw neither
    await edit(A, S + 400, () => repo.purgeAssets(A, [id]));
    expect((await A.select().from(clientSchema.outbox))[0]!.fields).toEqual({
      deletedAt: S + 400,
      purgedAt: S + 400,
    });
    await settle();
    expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 200, purgedAt: S + 400 });
  });

  it('an offline delete and purge of an asset no device restored apply', async () => {
    const id = await seedAsset();
    await edit(A, S + 200, () => repo.remove(A, [id]));
    await edit(A, S + 400, () => repo.purgeAssets(A, [id]));
    await settle();
    expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 200, purgedAt: S + 400 });
  });

  it('a deletion whose push landed unanswered, then a purge elsewhere: the device still takes the purge', async () => {
    const id = await seedAsset();
    await edit(B, S + 100, () => repo.remove(B, [id]));
    at(SERVER_NOW);
    await runSyncOnce(B, unansweredTransport(B, { refused: true })); // it lands, but B never hears back
    await retryFailures(B);
    await sync(A);
    await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
    await sync(A);

    const { removed, removeFiles } = removedFiles({ thumbnails: false });
    await pullOnly(B, SERVER_NOW, { removeFiles }); // pulls the purge
    expect(await localRow(B, 'assets', id)).toMatchObject({ purgedAt: null }); // its deletion still waits
    await sync(B, { removeFiles }); // its deletion again: the server answers with the purge
    expect(pushLog.at(-1)!.results[0]!.status).toBe('skipped-lww');
    await settle();
    expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 100, purgedAt: S + 200 });
    expect(removed).toEqual(['a.jpg']);
  });

  it('pushes to a purged row stay frozen: per-field apps, a whole-record app, a restore, nothing moves it', async () => {
    const id = await seedAsset();
    await edit(A, S + 100, () => repo.remove(A, [id]));
    await settle();
    await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
    await sync(A);
    const frozen = await serverRow('assets', id, { raw: true });

    await edit(B, S + 300, () => repo.update(B, id, { notes: 'B' }));
    await edit(C, S + 400, () => repo.updateAll(C, [id], { deletedAt: null, isFavorite: true }));
    await sync(B);
    await sync(C);
    expect(pushLog.slice(-2).map((entry) => entry.results[0]!.status)).toEqual(['skipped-lww', 'skipped-lww']);
    expect(await serverRow('assets', id, { raw: true })).toEqual(frozen); // not even server_seq or a clock moved
    await settle();
    expect(await expectConverged('assets', id)).toMatchObject({ purgedAt: S + 200, deletedAt: S + 100, notes: null });
  });

  it('a purge on one device while the other has pending edits: the other adopts it and removes its files', async () => {
    const id = await seedAsset({ filename: 'k.jpg', thumbnailFilename: 'k-t.jpg' });
    await edit(A, S + 100, () => repo.remove(A, [id]));
    await settle();
    await edit(B, S + 150, () => repo.update(B, id, { notes: 'B notes', isFavorite: true }));
    await edit(B, S + 250, () => repo.updateAll(B, [id], { deletedAt: null })); // and a restore, newer
    await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
    await sync(A);
    const { removed, removeFiles } = removedFiles({ thumbnails: false });
    await sync(B, { removeFiles });
    expect(removed).toEqual(['k.jpg']);
    await settle();
    expect(await expectConverged('assets', id)).toMatchObject({
      purgedAt: S + 200,
      deletedAt: S + 100,
      notes: null,
      isFavorite: false,
    });
  });

  describe('a restore beats a purge', () => {
    it('a restore beats a purge that hadn’t seen it when the deleting device’s clock is ahead', async () => {
      const id = await seedAsset({ filename: 'skew.jpg', thumbnailFilename: 'skew-t.jpg' });
      await edit(B, S + HOUR + 100, () => repo.remove(B, [id])); // B's clock is an hour ahead
      await sync(B, { now: S + 100 });
      await sync(A, { now: S + 150 });
      await edit(A, S + 200, () => repo.updateAll(A, [id], { deletedAt: null }));
      await sync(A, { now: S + 200 });
      await edit(B, S + HOUR + 300, () => repo.purgeAssets(B, [id])); // B never pulled the restore
      await sync(B, { now: S + 300 });
      const { removed, removeFiles } = removedFiles();
      await sync(A, { now: S + 400, removeFiles });
      await settle();
      expect(removed).toEqual([]);
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
    });

    it('a purge that loses keeps a file it shares with a purge that wins in the same push', async () => {
      const x = await seedAsset({ filename: 'shared.jpg', thumbnailFilename: 'x-t.jpg' });
      const y = await seedAsset({ filename: 'shared.jpg', thumbnailFilename: 'y-t.jpg' });
      await edit(A, S + 100, () => repo.remove(A, [x, y]));
      await settle();
      await edit(B, S + 200, () => repo.updateAll(B, [y], { deletedAt: null }));
      await sync(B);
      await edit(A, S + 300, () => repo.purgeAssets(A, [x, y])); // A never saw y restored
      const { removed, removeFiles } = removedFiles();
      await sync(A, { removeFiles });
      expect(await localRow(A, 'assets', y)).toMatchObject({ deletedAt: null, purgedAt: null });
      expect(removed).toEqual(['x-t.jpg']); // shared.jpg is y's file too, and y is back
      await settle();
      expect(await expectConverged('assets', x)).toMatchObject({ purgedAt: S + 300 });
      expect(await expectConverged('assets', y)).toMatchObject({ deletedAt: null, purgedAt: null });
    });

    it('purge, restore, delete again, purge again across three devices: the last deletion is purged, files go once per device', async () => {
      const id = await seedAsset({ filename: 'cycle.jpg', thumbnailFilename: 'cycle-t.jpg' });
      await edit(A, S + 100, () => repo.remove(A, [id]));
      await settle();
      await edit(A, S + 200, () => repo.purgeAssets(A, [id])); // A, offline
      await edit(B, S + 300, () => repo.updateAll(B, [id], { deletedAt: null }));
      await sync(B);
      await edit(C, S + 50, () => repo.toggleFavorite(C, id)); // the whole-record app, older than everything
      await sync(C);
      const onA = removedFiles();
      await sync(A, { removeFiles: onA.removeFiles }); // A's purge loses to the restore it hadn't seen
      expect(onA.removed).toEqual([]);
      expect(await localRow(A, 'assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
      await settle();
      await edit(B, S + 400, () => repo.remove(B, [id]));
      await settle();
      await edit(A, S + 500, () => repo.purgeAssets(A, [id])); // this one saw the restore and the delete
      await edit(B, S + 600, () => repo.purgeAssets(B, [id])); // and B purges too, unaware
      const onB = removedFiles();
      await sync(A, { removeFiles: onA.removeFiles });
      await sync(B, { removeFiles: onB.removeFiles });
      for (let i = 0; i < 3; i++)
        for (const [device, removeFiles] of [
          [A, onA.removeFiles],
          [B, onB.removeFiles],
        ] as const)
          await sync(device, { removeFiles });
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 400, purgedAt: S + 500 });
      expect(onA.removed).toEqual(['cycle.jpg', 'cycle-t.jpg']);
      expect(onB.removed).toEqual(['cycle.jpg', 'cycle-t.jpg']);
    });

    it('a whole-record app’s stale record re-deletes a restored photo, and a purge that hadn’t seen the restore then applies', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.remove(A, [id]));
      await settle();
      await edit(B, S + 200, () => repo.updateAll(B, [id], { deletedAt: null }));
      await sync(B);
      await edit(C, S + 300, () => repo.update(C, id, { notes: 'C, in the Deleted album' })); // stale: deleted
      await sync(C); // its whole record re-deletes the photo at S+300 (§7)
      await edit(A, S + 250, () => repo.purgeAssets(A, [id])); // A never saw the restore
      await settle();
      // C's stale deletedAt (S+100) is newer by clock than B's restore, so A's purge of it applies.
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 100, purgedAt: S + 250 });
    });

    // An app without purges: no `fields`, and no purgedAt in its records.
    async function syncAsAppWithoutPurges(device: SyncDb) {
      at(SERVER_NOW);
      const base = transportOf(device);
      await runSyncOnce(device, {
        ...base,
        push: (req) =>
          base.push({
            mutations: req.mutations.map((m) => {
              const { purgedAt: _purgedAt, ...record } = m.record as Record<string, unknown>;
              return { ...m, record: record as PushMutation['record'] };
            }),
          }),
      });
    }

    it('whole-record apps against the purge rule: a whole-record purge keeps its whole-record rule, a pre-purge restore beats a later purge', async () => {
      // C (no fields) purges, unaware of B's restore: newer, its whole record re-deletes and purges (the
      // installed app removed its files at once, so refusing it would strand a live photo without them).
      const first = await seedAsset();
      await edit(A, S + 100, () => repo.remove(A, [first]));
      await settle();
      await edit(B, S + 200, () => repo.updateAll(B, [first], { deletedAt: null }));
      await sync(B);
      await edit(C, S + 300, () => repo.purgeAssets(C, [first]));
      await sync(C);
      expect(pushLog.at(-1)!.results[0]!.status).toBe('applied');
      await settle();
      expect(await expectConverged('assets', first)).toMatchObject({ deletedAt: S + 100, purgedAt: S + 300 });

      // C, as an app without purges, restores; A, unaware, purges later by clock.
      const second = await seedAsset();
      await edit(A, S + 100, () => repo.remove(A, [second]));
      await settle();
      await edit(C, S + 200, () => repo.updateAll(C, [second], { deletedAt: null }));
      await syncAsAppWithoutPurges(C);
      await edit(A, S + 300, () => repo.purgeAssets(A, [second]));
      await settle([A, B]);
      await syncAsAppWithoutPurges(C);
      await settle();
      expect(await expectConverged('assets', second)).toMatchObject({ deletedAt: null, purgedAt: null });
    });

    it('an app without purges pushing a stale record to a purged row: frozen, told so, and it converges', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.remove(A, [id]));
      await settle();
      await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
      await sync(A);
      const frozen = await serverRow('assets', id, { raw: true });
      await edit(C, S + 900, () => repo.updateAll(C, [id], { deletedAt: null, notes: 'C' }));
      await syncAsAppWithoutPurges(C);
      expect(pushLog.at(-1)!.results[0]).toMatchObject({ status: 'skipped-lww', current: { purgedAt: S + 200 } });
      expect(await serverRow('assets', id, { raw: true })).toEqual(frozen);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 100, purgedAt: S + 200, notes: null });
    });

    it('purges and restores across push batches of 500 and pull pages with pending edits converge; files go only for the purges that won', async () => {
      const n = 1100;
      at(S);
      const created = await repo.createMany(
        A,
        Array.from({ length: n }, (_, i) =>
          makeAssetRecord({ createdAt: S, updatedAt: S, filename: `g${i}.jpg`, thumbnailFilename: `g${i}-t.jpg` }),
        ),
      );
      const ids = created.map((r) => r.id);
      await settle([A, B]);
      await edit(A, S + 100, () => repo.remove(A, ids));
      await settle([A, B]);
      const restored = new Set(ids.filter((_, i) => i % 7 === 0));
      await edit(B, S + 200, () => repo.updateAll(B, [...restored], { deletedAt: null }));
      await edit(B, S + 250, () =>
        repo.updateAll(
          B,
          ids.filter((_, i) => i % 11 === 0),
          { notes: 'B' },
        ),
      );
      await sync(B);
      await edit(A, S + 300, () => repo.purgeAssets(A, ids)); // A never saw the restores
      const pending = ids.filter((_, i) => i % 13 === 0);
      await edit(B, S + 350, () => repo.updateAll(B, pending, { isFavorite: true })); // B, still offline
      const onA = removedFiles();
      await sync(A, { removeFiles: onA.removeFiles });
      const onB = removedFiles();
      // B pulls the purges around its pending favorites (its push refused), then pushes them.
      await pullOnly(B, SERVER_NOW, { removeFiles: onB.removeFiles });
      await sync(B, { removeFiles: onB.removeFiles });
      await settle([A, B]);
      const won = ids.filter((id) => !restored.has(id));
      const files = (list: string[]) =>
        list.flatMap((id) => {
          const i = ids.indexOf(id);
          return [`g${i}.jpg`, `g${i}-t.jpg`];
        });
      expect(onA.removed.sort()).toEqual(files(won).sort());
      expect(onB.removed.sort()).toEqual(files(won).sort());
      const serverRows = await pgDb.select().from(serverSchema.assets).where(eq(serverSchema.assets.userId, USER));
      const server = new Map(serverRows.map((row) => [row.id, synced('assets', row)]));
      for (const device of [A, B]) {
        const local = new Map(
          (await device.select().from(clientSchema.assets)).map((row) => [row.id, synced('assets', row)]),
        );
        expect(local).toEqual(server);
        expect(await device.select().from(clientSchema.outbox)).toEqual([]);
      }
      for (const [i, id] of ids.entries()) {
        const row = server.get(id)!;
        if (restored.has(id))
          expect(row).toMatchObject({ deletedAt: null, purgedAt: null, notes: i % 11 === 0 ? 'B' : null });
        else expect(row).toMatchObject({ deletedAt: S + 100, purgedAt: S + 300 });
        // B's favorite survives on a restored photo; a purged one is frozen without it.
        expect(row.isFavorite).toBe(restored.has(id) && i % 13 === 0);
      }
    }, 120_000);
  });

  describe("the server's cleanup of purged files", () => {
    // Like the push route, every push is followed by the purge cleanup; the storage is a list of the
    // keys deleted from it.
    let deletedKeys: string[] = [];
    function cleanupTransport(device: SyncDb): SyncTransport {
      const transport = transportOf(device);
      return {
        ...transport,
        push: async (req) => {
          const answer = await transport.push(req);
          await deletePurgedFiles(pgDb as any, USER, async (keys) => {
            deletedKeys.push(...keys);
            return [];
          });
          return answer;
        },
      };
    }
    beforeEach(() => {
      deletedKeys = [];
    });

    it('a permanent delete wins over a stale restore: the cloud files go once and the asset stays gone on both', async () => {
      const rec = await repo.create(A, makeAssetRecord({ filename: 'p.jpg', thumbnailFilename: 'p-t.jpg' }));
      await repo.remove(A, [rec.id]);
      await runSyncOnce(A, cleanupTransport(A));
      await runSyncOnce(B, cleanupTransport(B));

      // B restores it while offline, after A purged it (B's clock is later); A's purge reaches the server first.
      const onA = removedFiles();
      await repo.purgeAssets(A, [rec.id]);
      tick();
      await repo.updateAll(B, [rec.id], { deletedAt: null });

      await runSyncOnce(A, cleanupTransport(A), { removeFiles: onA.removeFiles }); // the purge; A's copies go once the server has it, the cloud's after the push
      expect(onA.removed).toEqual(['p.jpg', 'p-t.jpg']);
      expect(deletedKeys).toEqual(['p.jpg', 'p-t.jpg']);
      const onB = removedFiles({ thumbnails: false });
      await runSyncOnce(B, cleanupTransport(B), { removeFiles: onB.removeFiles }); // B's restore loses, B adopts the purge
      await runSyncOnce(A, cleanupTransport(A));

      expect(onB.removed).toContain('p.jpg');
      for (const device of [A, B]) {
        const [row] = await device.select().from(clientSchema.assets).where(eq(clientSchema.assets.id, rec.id));
        expect(row).toMatchObject({ purgedAt: expect.any(Number), deletedAt: expect.any(Number) });
        expect(await device.select().from(clientSchema.outbox)).toEqual([]);
      }
      expect(deletedKeys).toEqual(['p.jpg', 'p-t.jpg']); // nobody deletes them again
    });

    it('an offline device’s purge loses to a restore another device pushed first: the asset and its cloud files stay', async () => {
      const rec = await repo.create(A, makeAssetRecord({ filename: 'r.jpg', thumbnailFilename: 'r-t.jpg' }));
      await repo.remove(A, [rec.id]);
      await runSyncOnce(A, cleanupTransport(A));
      await runSyncOnce(B, cleanupTransport(B));

      await repo.purgeAssets(A, [rec.id]); // A, offline
      tick();
      await repo.updateAll(B, [rec.id], { deletedAt: null }); // B restores it later
      await runSyncOnce(B, cleanupTransport(B));

      await runSyncOnce(A, cleanupTransport(A)); // A's older purge loses, A adopts the restore
      await runSyncOnce(B, cleanupTransport(B));

      expect(deletedKeys).toEqual([]);
      for (const device of [A, B]) {
        expect(await readLiveAsset(device, rec.id)).toMatchObject({ purgedAt: null, deletedAt: null });
        expect(await device.select().from(clientSchema.outbox)).toEqual([]);
      }
    });
  });
});
