import { eq } from 'drizzle-orm';
import { describe, it, expect, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { prng } from './helpers/prng';
import {
  A,
  B,
  C,
  HOUR,
  S,
  USER,
  at,
  freshDevices,
  localRow,
  oldApps,
  pgDb,
  synced,
  transportOf,
  useTwoDeviceServer,
} from './helpers/twoDeviceServer';
import * as serverSchema from '../../server/src/db/schema.js';
import * as repo from '../src/sync/assetsRepository';
import type { RemoveFiles } from '../src/sync/assetsRepository';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { retryFailures } from '../src/sync/outbox';
import { runSyncOnce } from '../src/sync/worker';

// Seeded random interleavings of edits, deletes, restores, purges and syncs across the devices.
// Devices A, B and an old app C run against the real server engine on Postgres
// (helpers/twoDeviceServer). A library merge only lists and moves files; these devices have none.
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/library/fs', async () => (await import('./helpers/fakeDevice')).noFiles());

// Run with `npm run test:e2e` (docker stack up); skipped otherwise.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

d('per-field merge, adversarial (devices A, B, an old app C ↔ server)', () => {
  useTwoDeviceServer();

  describe('random interleavings (seeded, the real client and server)', () => {
    // One seeded case: four photos (two share a file), devices A and B, C an old app half the time,
    // random clock skew, edits, deletes, restores and purges, syncs, pushes whose answer is lost and
    // pulls around a waiting edit. Then every device syncs until quiet.
    async function fuzzCase(seed: number, steps: number): Promise<string[]> {
      const rand = prng(seed);
      const problems: string[] = [];
      const fail = (step: number, message: string) => problems.push(`seed ${seed} step ${step}: ${message}`);
      await freshDevices();
      const devices = [A, B, C];
      const names = new Map<SyncDb, string>([
        [A, 'A'],
        [B, 'B'],
        [C, 'C'],
      ]);
      oldApps.clear();
      if (rand.chance(0.5)) oldApps.add(C);
      const skews = [0, 0, HOUR, -HOUR, 2_000, -2_000];
      const skew = new Map(devices.map((device) => [device, rand.pick(skews)]));
      const removed = new Map(devices.map((device) => [device, [] as string[]]));
      const removeFilesOf =
        (device: SyncDb): RemoveFiles =>
        async (files) => {
          const names = new Set(
            files.flatMap((f) => [f.filename, f.thumbnailFilename].filter((n): n is string => !!n)),
          );
          removed.get(device)!.push(...names);
        };

      at(S);
      const created = await repo.createMany(
        A,
        [0, 1, 2, 3].map((i) =>
          makeAssetRecord({
            createdAt: S,
            updatedAt: S,
            filename: i < 2 ? 'shared.jpg' : `own${i}.jpg`,
            thumbnailFilename: `thumb${i}.jpg`,
          }),
        ),
      );
      const ids = created.map((r) => r.id);
      let t = S + 10;
      const syncAt = async (device: SyncDb, now: number) => {
        at(now);
        await runSyncOnce(device, transportOf(device), { removeFiles: removeFilesOf(device) });
      };
      for (let round = 0; round < 2; round++) for (const device of devices) await syncAt(device, t);

      // The server rows, raw (server_seq and field_clock included), to check every step against.
      const rawRows = async () =>
        new Map(
          (await pgDb.select().from(serverSchema.assets).where(eq(serverSchema.assets.userId, USER))).map((row) => [
            row.id,
            row as Record<string, any>,
          ]),
        );
      let before = await rawRows();
      const unanswered = new Set<SyncDb>();
      const ops = [
        'delete',
        'restore',
        'purge',
        'favorite',
        'notes',
        'sync',
        'sync',
        'sync',
        'lost',
        'pullOnly',
      ] as const;

      for (let step = 0; step < steps; step++) {
        t += rand.pick([1, 5, 50, 300]);
        const device = rand.pick(devices);
        const subset = ids.filter(() => rand.chance(0.5));
        const rows = (await device.select().from(clientSchema.assets)).filter((row) => subset.includes(row.id));
        const alive = rows.filter((row) => row.purgedAt === null);
        const deleted = alive.filter((row) => row.deletedAt !== null);
        const op = rand.pick(ops);
        if (process.env.FUZZ_LOG)
          console.log(
            step,
            t - S,
            names.get(device),
            op,
            rows
              .map(
                (r) =>
                  `${ids.indexOf(r.id)}:${r.deletedAt ? 'd' : ''}${r.purgedAt ? 'p' : ''}${r.purgedAt && r.filesRemovedFor === r.purgedAt ? 'r' : ''}`,
              )
              .join(' '),
            JSON.stringify(
              (await device.select().from(clientSchema.outbox)).map((o) => [
                ids.indexOf(o.recordId),
                Object.keys(o.fields).join(','),
                o.error,
              ]),
            ),
          );
        at(t + skew.get(device)!);
        if (op === 'delete')
          await repo.remove(
            device,
            alive.filter((row) => row.deletedAt === null).map((row) => row.id),
          );
        if (op === 'restore')
          await repo.updateAll(
            device,
            deleted.map((row) => row.id),
            { deletedAt: null },
          );
        if (op === 'purge')
          await repo.purgeAssets(
            device,
            deleted.map((row) => row.id),
          );
        if (op === 'favorite' && alive[0]) await repo.toggleFavorite(device, alive[0].id);
        if (op === 'notes' && alive[0])
          await repo.update(device, alive[0].id, { notes: `${names.get(device)}${step}` });
        if (op === 'sync' || (op === 'pullOnly' && unanswered.has(device))) {
          unanswered.delete(device);
          await syncAt(device, t);
        }
        if (op === 'lost') {
          // The push lands, but the device never hears back: the run fails, and the next one pushes again.
          at(t);
          const base = transportOf(device);
          await runSyncOnce(
            device,
            {
              ...base,
              push: async (req) => {
                await base.push(req);
                throw new Error('no answer');
              },
            },
            { removeFiles: removeFilesOf(device) },
          ).catch(() => {});
          unanswered.add(device);
        }
        if (op === 'pullOnly' && !unanswered.has(device)) {
          // Offline for pushes (each refused), so the pull applies around the waiting edits (§5).
          at(t);
          await runSyncOnce(
            device,
            {
              ...transportOf(device),
              push: async (req) => ({
                results: req.mutations.map((m) => ({
                  id: String(m.record.id),
                  collection: m.collection,
                  status: 'rejected' as const,
                  reason: 'offline',
                })),
              }),
            },
            { removeFiles: removeFilesOf(device) },
          );
          await retryFailures(device);
        }

        const after = await rawRows();
        for (const [id, row] of after) {
          const prev = before.get(id)!;
          if (prev.purgedAt !== null && JSON.stringify(row) !== JSON.stringify(prev))
            fail(step, `the purged row ${id} changed: ${JSON.stringify(prev)} → ${JSON.stringify(row)}`);
          const { serverSeq: _s, ...rest } = row;
          const { serverSeq: _p, ...restBefore } = prev;
          if (row.serverSeq !== prev.serverSeq && JSON.stringify(rest) === JSON.stringify(restBefore))
            fail(step, `a new server_seq for an unchanged row ${id}`);
        }
        before = after;
      }

      for (let round = 0; round < 4; round++) for (const device of devices) await syncAt(device, t + 10_000_000);

      const server = await rawRows();
      for (const id of ids) {
        const expected = synced('assets', server.get(id));
        for (const device of devices) {
          const local = synced('assets', await localRow(device, 'assets', id));
          if (JSON.stringify(local) !== JSON.stringify(expected))
            fail(
              steps,
              `${names.get(device)} diverged on ${id}: ${JSON.stringify(local)} vs ${JSON.stringify(expected)}`,
            );
        }
      }
      for (const device of devices)
        if ((await device.select().from(clientSchema.outbox)).length > 0)
          fail(steps, `${names.get(device)} has pending rows`);

      // Files: each device removed, once, exactly the names only purged photos use.
      const live = [...server.values()].filter((row) => row.purgedAt === null);
      const inUse = new Set(live.flatMap((row) => [row.filename, row.thumbnailFilename]));
      const gone = new Set(
        [...server.values()]
          .filter((row) => row.purgedAt !== null)
          .flatMap((row) => [row.filename, row.thumbnailFilename])
          .filter((name) => !inUse.has(name)),
      );
      for (const device of devices) {
        const list = removed.get(device)!;
        if (new Set(list).size !== list.length) fail(steps, `${names.get(device)} removed a file twice: ${list}`);
        if (JSON.stringify([...new Set(list)].sort()) !== JSON.stringify([...gone].sort()))
          fail(steps, `${names.get(device)} removed ${[...list].sort()}, expected ${[...gone].sort()}`);
      }
      return problems;
    }

    it('60 seeded cases of 30 steps converge, keep purged rows frozen and remove each purged file once per device', async () => {
      const problems: string[] = [];
      const only = Number(process.env.FUZZ_SEED);
      const cases = Number(process.env.FUZZ_CASES ?? 60);
      for (let seed = 1; seed <= cases; seed++)
        if (!only || seed === only) problems.push(...(await fuzzCase(seed, 30)));
      expect(problems.slice(0, 8)).toEqual([]);
    }, 300_000);
  });
});
