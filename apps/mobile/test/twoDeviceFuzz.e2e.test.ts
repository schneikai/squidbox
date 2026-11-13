import { and, eq, isNull } from 'drizzle-orm';
import { describe, it, expect } from 'vitest';

import { crashableDevice } from './helpers/crashableDevice';
import { makeAlbumRecord, makeAssetRecord, makeContactRecord } from './helpers/factory';
import { fuzzRuns } from './helpers/fuzzRuns';
import { fuzzedCollections } from './helpers/fuzzedCollections';
import { prng } from './helpers/prng';
import {
  HOUR,
  S,
  USER,
  albumRepo,
  at,
  clearServer,
  pgDb,
  pullOnly,
  removedFiles,
  sync,
  synced,
  unansweredTransport,
  useTwoDeviceServer,
  wholeRecordApps,
} from './helpers/twoDeviceServer';
import * as serverSchema from '../../server/src/db/schema.js';
import { serverCollections } from '../../server/src/sync/collections.js';
import * as repo from '../src/sync/assetsRepository';
import { clientCollectionTables } from '../src/sync/clientCollections';
import * as lists from '../src/sync/contactListsRepository';
import * as contacts from '../src/sync/contactsRepository';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { contactLinks, contactListMembers } from '../src/sync/membershipRepository';
import { runSyncOnce } from '../src/sync/worker';

// Seeded random interleavings of edits, deletes, restores, purges and syncs across the devices, on
// photos, an album's photos, contacts, a list's contacts and the contacts on photos, with the app
// killed in the middle of a write or a sync now and then. Devices A, B and C (pushing whole records
// half the time) run against the real server engine on Postgres (helpers/twoDeviceServer).
const albumEdges = makeEdgeRepository('album_assets', clientSchema.albumAssets, 'albumId');

describe('random interleavings (seeded, the real client and server)', () => {
  useTwoDeviceServer();

  // One seeded case: four photos (two share a file) in an album, three contacts and a list, devices
  // A, B and C, random clock skew; edits, deletes, restores and purges of photos, the album's photos
  // added, removed and reordered, contacts edited, deleted and restored, put on the list and on
  // photos and taken off; syncs, pushes whose answer is lost, pulls around a waiting edit, and the
  // app killed at a random statement of any of those. Then every device syncs until quiet.
  // FUZZ_SEED replays one case, FUZZ_LOG prints its steps.
  const CASES = fuzzRuns(6, 60);

  // The collections a case left records in go to `written`.
  async function fuzzCase(seed: number, steps: number, written: Set<string>): Promise<string[]> {
    const rand = prng(seed);
    const problems: string[] = [];
    const fail = (step: number, message: string) => problems.push(`seed ${seed} step ${step}: ${message}`);
    // Ids from the seed, so a case replays exactly (edges tie on position by id).
    const newId = () =>
      Array.from({ length: 32 }, () => Math.floor(rand.next() * 16).toString(16))
        .join('')
        .replace(/^(.{8})(.{4}).(.{3}).(.{3})(.{12})$/, '$1-$2-4$3-8$4-$5');
    await clearServer();
    const devices = [crashableDevice(), crashableDevice(), crashableDevice()];
    const names = ['A', 'B', 'C'];
    // C pushes whole records half the time; a restart opens a new db, so this follows it.
    const wholeRecordC = rand.chance(0.5);
    const markWholeRecordApp = () => {
      wholeRecordApps.clear();
      if (wholeRecordC) wholeRecordApps.add(devices[2]!.db);
    };
    markWholeRecordApp();
    const skews = [0, 0, HOUR, -HOUR, 2_000, -2_000];
    const skew = devices.map(() => rand.pick(skews));
    const removed = devices.map(() => removedFiles({ oncePerCall: true }));
    const crashed = new Set<number>();

    at(S);
    const first = devices[0]!.db;
    const created = await repo.createMany(
      first,
      [0, 1, 2, 3].map((i) =>
        makeAssetRecord({
          id: newId(),
          createdAt: S,
          updatedAt: S,
          filename: i < 2 ? 'shared.jpg' : `own${i}.jpg`,
          thumbnailFilename: `thumb${i}.jpg`,
        }),
      ),
    );
    const ids = created.map((r) => r.id);
    const albumId = (await albumRepo.create(first, makeAlbumRecord({ id: newId(), createdAt: S, updatedAt: S }))).id;
    await albumEdges.add(first, albumId, ids.slice(0, 2), newId);
    const contactIds: string[] = [];
    for (const name of ['Ann', 'Ben', 'Cy'])
      contactIds.push(
        (await contacts.create(first, makeContactRecord({ id: newId(), name, createdAt: S, updatedAt: S }))).id,
      );
    const listId = (
      await lists.create(first, {
        id: newId(),
        createdAt: S,
        updatedAt: S,
        deletedAt: null,
        name: 'Hikes',
        notes: null,
        pinnedAt: null,
      })
    ).id;
    await contactListMembers.add(first, { listId }, contactIds.slice(0, 1), newId);
    let t = S + 10;
    const syncAt = (i: number, now: number) => sync(devices[i]!.db, { now, removeFiles: removed[i]!.removeFiles });
    for (let round = 0; round < 2; round++) for (const i of devices.keys()) await syncAt(i, t);

    // The server rows, raw (server_seq and field_clock included), to check every step against.
    const rawRows = async () =>
      new Map(
        (await pgDb.select().from(serverSchema.assets).where(eq(serverSchema.assets.userId, USER))).map((row) => [
          row.id,
          row,
        ]),
      );
    let before = await rawRows();
    const unanswered = new Set<number>();
    const ops = [
      'delete',
      'restore',
      'purge',
      'favorite',
      'notes',
      'sync',
      'sync',
      'sync',
      'sync',
      'lost',
      'pullOnly',
      'contact',
      'contactDelete',
      'contactRestore',
      'album',
      'album',
      'list',
      'link',
      'link',
      'crash',
      'crash',
    ] as const;
    type Op = Exclude<(typeof ops)[number], 'crash'>;
    const subsetOf = <T>(list: T[]) => list.filter(() => rand.chance(0.5));
    const shuffled = <T>(list: T[]) =>
      list
        .map((item) => [rand.next(), item] as const)
        .sort(([a], [b]) => a - b)
        .map(([, item]) => item);

    // Runs `op` on device `i` with `db`, its app's database now: first the reads that pick what it
    // changes, then `arm` (a crash counts the statements after it), then the op.
    async function run(op: Op, i: number, db: SyncDb, step: number, arm = () => {}) {
      const rows = (await db.select().from(clientSchema.assets)).filter(
        (row) => rand.chance(0.5) && ids.includes(row.id),
      );
      const alive = rows.filter((row) => row.purgedAt === null);
      const deleted = alive.filter((row) => row.deletedAt !== null);
      const liveIds = (await db.select().from(clientSchema.assets))
        .filter((row) => row.deletedAt === null && row.purgedAt === null)
        .map((row) => row.id);
      const people = await db.select().from(clientSchema.contacts);
      const person = rand.pick(people);
      const livePeople = people.filter((row) => row.deletedAt === null).map((row) => row.id);
      const inAlbum = (
        await db
          .select()
          .from(clientSchema.albumAssets)
          .where(and(eq(clientSchema.albumAssets.albumId, albumId), isNull(clientSchema.albumAssets.deletedAt)))
          .orderBy(clientSchema.albumAssets.position, clientSchema.albumAssets.id)
      ).map((edge) => edge.assetId);
      arm();
      if (op === 'delete')
        await repo.remove(
          db,
          alive.filter((row) => row.deletedAt === null).map((row) => row.id),
        );
      if (op === 'restore')
        await repo.updateAll(
          db,
          deleted.map((row) => row.id),
          { deletedAt: null },
        );
      if (op === 'purge')
        await repo.purgeAssets(
          db,
          deleted.map((row) => row.id),
        );
      if (op === 'favorite' && alive[0]) await repo.toggleFavorite(db, alive[0].id);
      if (op === 'notes' && alive[0]) await repo.update(db, alive[0].id, { notes: `${names[i]}${step}` });
      if (op === 'sync' || (op === 'pullOnly' && unanswered.has(i))) {
        unanswered.delete(i);
        await sync(db, { now: t, removeFiles: removed[i]!.removeFiles });
      }
      if (op === 'lost') {
        // The push lands, but the device never hears back: the run fails, and the next one pushes again.
        at(t);
        await runSyncOnce(db, unansweredTransport(db), { removeFiles: removed[i]!.removeFiles }).catch(() => {});
        unanswered.add(i);
      }
      if (op === 'pullOnly' && !unanswered.has(i)) {
        // Offline for pushes (each refused), so the pull applies around the waiting edits (§5).
        await pullOnly(db, t, { removeFiles: removed[i]!.removeFiles });
      }
      if (op === 'contact' && person && person.deletedAt === null) {
        if (rand.chance(0.5)) await contacts.toggleFavorite(db, person.id);
        else await contacts.update(db, person.id, { notes: `${names[i]}${step}` });
      }
      if (op === 'contactDelete' && person && person.deletedAt === null) await contacts.deleteContact(db, person.id);
      if (op === 'contactRestore' && person && person.deletedAt !== null)
        await contacts.update(db, person.id, { deletedAt: null });
      if (op === 'album') {
        const kind = rand.pick(['add', 'remove', 'reorder', 'move'] as const);
        if (kind === 'add') await albumEdges.add(db, albumId, subsetOf(liveIds), newId);
        if (kind === 'remove') await albumEdges.remove(db, albumId, subsetOf(inAlbum));
        if (kind === 'reorder') await albumEdges.reorder(db, albumId, shuffled(inAlbum));
        if (kind === 'move' && inAlbum.length > 1) {
          const assetId = rand.pick(inAlbum);
          const others = inAlbum.filter((id) => id !== assetId);
          await albumEdges.move(db, albumId, assetId, rand.chance(0.3) ? null : rand.pick(others));
        }
      }
      if (op === 'list' || op === 'link') {
        const added = subsetOf(livePeople);
        const removedPeople = subsetOf(contactIds.filter((id) => !added.includes(id)));
        if (op === 'list') await contactListMembers.change(db, { listId }, { added, removed: removedPeople }, newId);
        const photo = rand.pick(liveIds);
        if (op === 'link' && photo)
          await contactLinks.change(
            db,
            { targetType: 'asset', targetId: photo },
            { added, removed: removedPeople },
            newId,
          );
      }
    }

    for (let step = 0; step < steps; step++) {
      t += rand.pick([1, 5, 50, 300]);
      const i = rand.pick([...devices.keys()]);
      let op: Op;
      let statement: number | null = null;
      const picked = rand.pick(ops);
      if (picked === 'crash') {
        op = rand.pick(ops.filter((o): o is Op => o !== 'crash'));
        // Most often early: a write is a few statements, a sync many more.
        statement = 1 + Math.floor(rand.next() ** 2 * 20);
      } else op = picked;
      if (process.env.FUZZ_LOG)
        console.log(
          step,
          t - S,
          names[i],
          op,
          statement === null ? '' : `killed at statement ${statement}`,
          JSON.stringify(
            (await devices[i]!.db.select().from(clientSchema.outbox)).map((o) => [
              o.collection,
              o.recordId.slice(0, 4),
              Object.keys(o.fields).join(','),
              o.error,
            ]),
          ),
        );
      at(t + skew[i]!);
      if (statement === null) await run(op, i, devices[i]!.db, step);
      else if (await devices[i]!.crashDuring(statement, (db, arm) => run(op, i, db, step, arm))) {
        crashed.add(i);
        markWholeRecordApp();
        if (process.env.FUZZ_LOG) console.log('  killed');
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

    for (let round = 0; round < 4; round++) for (const i of devices.keys()) await syncAt(i, t + 10_000_000);

    // Every device holds what the server holds, record for record, in every collection the case wrote.
    for (const collection of [...fuzzedCollections, 'albums', 'contact_lists']) {
      const { table, wireColumns } = serverCollections[collection]!;
      // drizzle: a table picked by name has no typed columns (as twoDeviceServer's serverRows)
      const rows = await pgDb
        .select(wireColumns)
        .from(table)
        .where(eq((table as any).userId, USER));
      const server = new Map(rows.map((row) => [row.id as string, synced(collection, row)]));
      if (server.size > 0) written.add(collection);
      for (const [i, device] of devices.entries()) {
        const local = await device.db.select().from(clientCollectionTables[collection]!);
        const mine = new Map(local.map((row) => [row.id, synced(collection, row)]));
        for (const id of new Set([...server.keys(), ...mine.keys()]))
          if (JSON.stringify(mine.get(id)) !== JSON.stringify(server.get(id)))
            fail(
              steps,
              `${names[i]} diverged on ${collection} ${id}: ${JSON.stringify(mine.get(id))} vs ${JSON.stringify(server.get(id))}`,
            );
      }
    }
    for (const [i, device] of devices.entries())
      if ((await device.db.select().from(clientSchema.outbox)).length > 0) fail(steps, `${names[i]} has pending rows`);

    // Files: each device removed exactly the names only purged photos use, once (a device killed
    // between removing a file and noting it removes it again, which finds it gone).
    const server = await rawRows();
    const live = [...server.values()].filter((row) => row.purgedAt === null);
    const inUse = new Set(live.flatMap((row) => [row.filename, row.thumbnailFilename]));
    const gone = new Set(
      [...server.values()]
        .filter((row) => row.purgedAt !== null)
        .flatMap((row) => [row.filename, row.thumbnailFilename])
        .filter((name) => !inUse.has(name)),
    );
    for (const i of devices.keys()) {
      const list = removed[i]!.removed;
      if (!crashed.has(i) && new Set(list).size !== list.length)
        fail(steps, `${names[i]} removed a file twice: ${list}`);
      if (JSON.stringify([...new Set(list)].sort()) !== JSON.stringify([...gone].sort()))
        fail(steps, `${names[i]} removed ${[...list].sort()}, expected ${[...gone].sort()}`);
    }
    return problems;
  }

  it(`${CASES} seeded cases of 40 steps on photos, albums, contacts, lists and photo contacts converge, with the app killed mid-write, keep purged rows frozen and remove each purged file once per device`, async () => {
    const problems: string[] = [];
    const written = new Set<string>();
    const only = Number(process.env.FUZZ_SEED);
    for (let seed = only || 1; seed <= (only || CASES); seed++) problems.push(...(await fuzzCase(seed, 40, written)));
    expect(problems.slice(0, 8)).toEqual([]);
    if (!only) expect([...written].sort()).toEqual(expect.arrayContaining([...fuzzedCollections].sort()));
  }, 300_000);
});
