import { gate } from '@squidbox/shared/testing/gate';
import { eq } from 'drizzle-orm';
import { describe, it, expect, vi, onTestFinished } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { faults, files, stores } from './helpers/fakeDevice';
import { fuzzRuns } from './helpers/fuzzRuns';
import {
  ACC,
  DEV,
  SRC,
  TGT,
  addToTrip,
  deletedElsewhere,
  devicePhoto,
  entry,
  pushOlderHalf,
  resetLibraries,
  resetToAccount,
} from './helpers/mergeDevice';
import { mergeLosses } from './helpers/mergeLosses';
import { prng } from './helpers/prng';
import { seedAccountPhotos } from './helpers/seedAccountPhotos';
import { seedDevicePhotos } from './helpers/seedDevicePhotos';
import { purgedFilesRemover } from '../src/library/fs';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { sweepPurgedFiles } from '../src/sync/sweepPurgedFiles';
import { upsertRows } from '../src/sync/upsertRows';
import { getAssetFileUri } from '../src/utils/assets/assetStorage';

// A merge pass (mergeRun.ts) failing, or the app dying, at each of its steps, then the
// device library opened again while the session is lost (its photo purged there, its open-sweep
// run), then the boot's resume. The invariant (sync-design §7a, §8): a device photo whose record an
// account library holds keeps a file somewhere (the device library's folder or the account's) while
// its purge can still lose in the account; and a merge that completes leaves no marker.

// The scenarios' device photos have no thumbnail file.
const photoOnDevice = (over: Record<string, unknown>) => devicePhoto(over, { thumbnail: false });

// The device (helpers/fakeDevice), with its faults: the step that fails, and whether the process
// dies there (nothing after it runs, no catch block).
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/sync/db/client', async () => (await import('./helpers/fakeDevice')).dbClient());
vi.mock('@react-native-async-storage/async-storage', async () => (await import('./helpers/fakeDevice')).asyncStorage());
vi.mock('../src/library/fs', async () => (await import('./helpers/fakeDevice')).libraryFs());
vi.mock('../src/sync/status', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/sync/status')>();
  const { faults, reach } = await import('./helpers/fakeDevice');
  return {
    ...original,
    getMergeTarget: async (...args: Parameters<typeof original.getMergeTarget>) => {
      reach('readMarker');
      return original.getMergeTarget(...args);
    },
    setMergeTarget: async (...args: Parameters<typeof original.setMergeTarget>) => {
      if (faults.dead) return;
      const [, marker] = args;
      reach(marker ? (marker.committed ? 'commitMarker' : 'setMarker') : 'clearMarker');
      return original.setMergeTarget(...args);
    },
    // The finish (finishMerge) and what the pass records after its move.
    setMergeMarks: async (...args: Parameters<typeof original.setMergeMarks>) => {
      if (faults.dead) return;
      reach(args[2] ? 'sourceMarks' : 'forgetMarks');
      return original.setMergeMarks(...args);
    },
    clearMergeCommit: async (...args: Parameters<typeof original.clearMergeCommit>) => {
      if (faults.dead) return;
      reach('clearCommit');
      return original.clearMergeCommit(...args);
    },
    setMergeCommit: async (...args: Parameters<typeof original.setMergeCommit>) => {
      if (faults.dead) return;
      reach('movedFlag');
      return original.setMergeCommit(...args);
    },
  };
});
vi.mock('../src/library/mergeLibrary', async (importOriginal) =>
  (await import('./helpers/fakeDevice')).mergeLibraryWithFaults(await importOriginal()),
);
vi.mock('../src/library/registry', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/library/registry')>();
  const { faults, reach } = await import('./helpers/fakeDevice');
  return {
    ...original,
    updateLibrary: async (...args: Parameters<typeof original.updateLibrary>) => {
      if (faults.dead) return original.getRegistry();
      const before = original.getRegistry().libraries.find((library) => library.id === args[0]);
      const after = args[1](before!);
      const marker = after.mergedInto;
      reach(marker ? (marker.committed ? 'listCommitted' : 'listMarker') : after.keptFor ? 'listKept' : 'listClear');
      return original.updateLibrary(...args);
    },
  };
});

const { closeLibrary, librarySweepsSettled, openLibrary, openLibraryId, sweepOpenLibrary } =
  await import('../src/library/current');
const { loadRegistry } = await import('../src/library/registry');
const { mergeLibrary, resumeMerges } = await import('../src/library/mergeRun');
const { getDb } = await import('../src/sync/db/client');
const status = await import('../src/sync/status');

// A fresh device whose account library pushes right after each commit; returns the device library.
const resetPushing = () => resetLibraries([DEV, ACC], { autoPush: true });

// The account's library pushes everything (the server took it all).
async function pushAll(db: AppDb) {
  await db.delete(schema.outbox);
}

const reached = new Set<string>();
const STEPS = [
  'listMarker',
  'readMarker',
  'plan',
  'setMarker',
  'apply',
  'afterCommit',
  'commitMarker',
  'listCommitted',
  'move',
  'movedFlag',
  'sourceMarks',
  'clearCommit',
  'clearMarker',
  'forgetMarks',
  'listKept',
  'deleteDb',
  'listClear',
];

// One scenario: a failure (or a crash) at `step` of the first pass, the device library opened while
// the session is lost and the photo purged there, then boots until the merge completes. Returns the
// invariant's violations.
async function scenario(step: string, crash: boolean, keepsSource: boolean): Promise<string[]> {
  const problems: string[] = [];
  const at = `${crash ? 'crash' : 'throw'} at ${step}${keepsSource ? ', source kept' : ''}`;
  reached.add(at);
  await resetPushing();
  const photo = await photoOnDevice({ filename: 'p.jpg', mediaLibraryAssetId: 'm-p' });
  if (keepsSource)
    await photoOnDevice({
      filename: 'cloud.jpg',
      mediaLibraryAssetId: 'm-c',
      isFileSynced: true,
    });
  await openLibrary(ACC);
  await status.markFirstSyncDone(getDb());

  const hasFile = () => files.has(getAssetFileUri('p.jpg', SRC)) || files.has(getAssetFileUri('p.jpg', TGT));
  const inAccount = async () =>
    (await stores.get(TGT.dbName)!.select().from(schema.assets)).some((row) => row.id === photo.id);

  Object.assign(faults, { step, crash });
  await mergeLibrary('dev', 'acc').catch(() => {});
  if (faults.step === step) {
    reached.delete(at); // this pass never reaches the step (e.g. no source kept: no clearMarker)
    return [];
  }
  faults.dead = false;

  // The session is lost: the device library opens (its open sweeps), and the photo is purged there.
  if (entry('dev')) {
    await closeLibrary();
    await openLibrary(DEV);
    await repo.remove(getDb(), [photo.id]);
    await repo.purgeAssets(getDb(), [photo.id]);
    sweepOpenLibrary();
    await librarySweepsSettled();
    if ((await inAccount()) && !hasFile())
      problems.push(`${at}: the account holds the photo, but the device purge removed its only file`);
    await closeLibrary();
    await openLibrary(ACC);
  }

  // Boots, signed in, the account's library pushed: the resume, then this device's library joins
  // (mergeDeviceLibrary's conditions).
  for (let boot = 0; boot < 2; boot++) {
    await pushAll(getDb());
    await resumeMerges();
    const dev = entry('dev');
    if (dev && !dev.mergedInto && !dev.keptFor) await mergeLibrary('dev', 'acc');
  }
  const dev = entry('dev');
  if (dev?.mergedInto) problems.push(`${at}: the list's marker stays after the merge completed`);
  if (stores.has(SRC.dbName) && dev && (await status.getMergeTarget(stores.get(SRC.dbName)!)))
    problems.push(`${at}: the source's marker stays after the merge completed`);
  if (Object.keys(await status.getMergeMarks(stores.get(TGT.dbName)!, SRC.dbName)).length > 0)
    problems.push(`${at}: the account's library keeps the merge's marks after it completed`);
  if (await status.getMergeCommit(stores.get(TGT.dbName)!, SRC.dbName))
    problems.push(`${at}: the account's library keeps the merge's commit after it completed`);
  if ((await inAccount()) && !hasFile()) problems.push(`${at}: the account holds the photo without its file`);
  return problems;
}

describe('a merge pass failing or crashing at each step, then a purge on the device, then the resume', () => {
  it('a crash at any step: the photo keeps a file while the account can restore it, and the merge completes clean', async () => {
    const problems: string[] = [];
    for (const keepsSource of [false, true])
      for (const step of STEPS) problems.push(...(await scenario(step, true, keepsSource)));
    expect(problems).toEqual([]);
    expect([...reached].filter((at) => at.startsWith('crash'))).toHaveLength(13 + 15); // the steps each shape reaches
  });

  // A throw after the commit (`afterCommit`) is left out: the catch block can't tell it from one
  // before, takes the markers back, and the device purge then removes the only file of a photo the
  // account holds. Nothing makes applyMerge reject once its transaction committed (the driver's only
  // listener, watchQuery's, never throws), so it is noted, not a case the merge has to handle.
  it('a throw at any step but after the commit: the same', async () => {
    const problems: string[] = [];
    for (const keepsSource of [false, true])
      for (const step of STEPS.filter((s) => s !== 'afterCommit'))
        problems.push(...(await scenario(step, false, keepsSource)));
    expect(problems).toEqual([]);
    expect([...reached].filter((at) => at.startsWith('throw'))).toHaveLength(12 + 14); // the steps each shape reaches
  });
});

// The device library's open-sweep still running when the sign-in switches to the account's
// library and the merge starts. closeLibrary aborts it (between batches) and closes its database, so
// a batch in flight can still remove its files but marks nothing; the merge then copies the live
// photos with their files, and leaves the purged ones (gone from the device for good) behind.
describe('a device library’s sweep running when the sign-in merges it', () => {
  it('stops at the switch, never touches a live photo’s file, and the merge completes', async () => {
    const source = await resetPushing();
    const purged = await repo.createMany(
      source,
      Array.from({ length: 2000 }, (_, i) =>
        makeAssetRecord({ filename: `gone${i}.jpg`, thumbnailFilename: `gone${i}-t.jpg`, isFileSynced: false }),
      ),
    );
    for (const asset of purged) files.add(getAssetFileUri(asset.filename, SRC));
    await repo.remove(
      source,
      purged.map((a) => a.id),
    );
    await repo.purgeAssets(
      source,
      purged.map((a) => a.id),
    );
    // A live photo sharing a purged one's name, and one of its own.
    const sharing = await photoOnDevice({ filename: 'gone7.jpg', mediaLibraryAssetId: 'm-s' });
    const own = await photoOnDevice({ filename: 'own.jpg', mediaLibraryAssetId: 'm-o' });

    const removal = gate();
    onTestFinished(() => removal.release());
    faults.removing = removal.hold;
    await openLibrary(DEV); // its sweep starts, without holding up the open
    await removal.entered; // its first batch is being removed
    const left = () => [...files].filter((uri) => uri.startsWith(getAssetFileUri('gone', SRC))).length;
    // The sign-in: the switch closes the device library, then its records join the account's.
    await closeLibrary();
    await openLibrary(ACC);
    await status.markFirstSyncDone(getDb());
    await mergeLibrary('dev', 'acc'); // committed, and the account's library pushes it
    removal.release(); // the batch in flight at the switch finishes
    await librarySweepsSettled();
    // The sweep stopped at the switch (a second batch at most): the rest goes with the source's folders.
    expect(left()).toBeGreaterThanOrEqual(2000 - 2 * 500 - 1);

    const inAccount = (await getDb().select().from(schema.assets)).map((row) => row.id).sort();
    expect(inAccount).toEqual([sharing.id, own.id].sort()); // the purged ones stay behind
    expect(files.has(getAssetFileUri('gone7.jpg', TGT))).toBe(true);
    expect(files.has(getAssetFileUri('own.jpg', TGT))).toBe(true);
    expect(entry('dev')).toBeUndefined();
  });
});

// After a crash between the finish (finishMerge) and the source's removal, the target holds
// no marks any more; the next finish adds the target's marks to the source's, so a second crash there
// leaves the source's decisions as they were.
// Scenario: the device's photo is merged into the account's copy of the same camera-roll item (its
// favorite OR'd in), the account pushes, the finish runs, and the app dies before the device library's
// database is deleted, twice in a row. Meanwhile another device deletes the account's photo (pulled
// as a tombstone). The match stands (sync-design §8: "a decision that was pushed stands ... a
// tombstone included"), so the deleted photo stays deleted.
describe('two crashes between a merge’s finish and the device library’s removal', () => {
  it('a photo the account deleted since the match stays deleted', async () => {
    await resetPushing();
    await openLibrary(ACC);
    await status.markFirstSyncDone(getDb());
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', filename: 'p.jpg', isFavorite: false });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]); // pulled, in the cloud
    await photoOnDevice({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true });
    await photoOnDevice({ mediaLibraryAssetId: 'm-o', filename: 'o.jpg' });

    // Pass 1: the match and the copy commit, the account pushes, the finish runs, then the app dies.
    Object.assign(faults, { step: 'deleteDb', crash: true });
    await mergeLibrary('dev', 'acc').catch(() => {});
    expect(faults.dead).toBe(true);
    // The next launch: the pass plans from the source's marks, finishes, and the app dies again there.
    Object.assign(faults, { step: 'deleteDb', crash: true, dead: false });
    await resumeMerges();
    expect(faults.dead).toBe(true);
    faults.dead = false;
    expect(entry('dev')).toBeDefined();
    // The pass after the finish keeps the list's marker committed, as the source's database says.
    expect(entry('dev')?.mergedInto?.committed).toBe(true);
    expect((await status.getMergeTarget(stores.get(SRC.dbName)!))?.committed).toBe(true);

    // Another device deletes the account's photo; this one pulls the tombstone.
    await upsertRows(getDb(), 'assets', schema.assets, [
      { ...accountPhoto, isFavorite: true, deletedAt: 5000, updatedAt: 5000, syncError: null },
    ]);

    await resumeMerges(); // the next launch
    expect(entry('dev')).toBeUndefined();
    const live = (await getDb().select().from(schema.assets)).filter((row) => row.deletedAt === null);
    expect(live.map((row) => row.mediaLibraryAssetId)).toEqual(['m-o']);
  });
});

// The app dies right after pass 1's commit, before the device library's marker says
// committed. The next pass writes nothing (the account holds the photo), but has joined the account's
// library all the same: it marks the device library's database committed too, not only the list, so
// a list rebuilt from it, or a pass after the finish, keeps it committed.
describe('a crash between the commit and the committed marker', () => {
  it('the next pass marks the device library committed in its database, before the files move', async () => {
    await resetPushing();
    await photoOnDevice({ filename: 'p.jpg', mediaLibraryAssetId: 'm-p' });
    await openLibrary(ACC);
    await status.markFirstSyncDone(getDb());
    const markerInDb = async () => (await status.getMergeTarget(stores.get(SRC.dbName)!))?.committed;

    Object.assign(faults, { step: 'afterCommit', crash: true });
    await mergeLibrary('dev', 'acc').catch(() => {});
    expect(faults.dead).toBe(true);
    faults.dead = false;
    expect(await markerInDb()).toBeUndefined();

    // The next launches: the pass moves the file, the account pushes, the finish runs, and the app
    // dies before the device library's deletion, twice.
    for (let crash = 0; crash < 2; crash++) {
      Object.assign(faults, { step: 'deleteDb', crash: true });
      await resumeMerges();
      expect(faults.dead).toBe(true);
      faults.dead = false;
      expect(entry('dev')?.mergedInto?.committed).toBe(true);
      expect(await markerInDb()).toBe(true);
      expect(files.has(getAssetFileUri('p.jpg', TGT))).toBe(true);
    }
  });
});

// Device photos of camera-roll items the account holds (with or without
// a file in the cloud), one living in another account's storage (the source is kept), in an album;
// passes that crash at any step, the account pushing all or part of its outbox, purging and deleting
// photos, uploading their files, and the device library opened and edited while it waits. Then the
// account pushes and a later edit of the account waits in its outbox at each boot. The merge completes
// (or keeps the source for the photo in another account's storage), and nothing of the device
// library is lost.
describe('seeded crashes', () => {
  const SEEDS = fuzzRuns(40, 150);
  async function reboot() {
    Object.assign(faults, { step: null, dead: false });
    if (openLibraryId()) await closeLibrary();
    await loadRegistry(async () => ({ libraries: [DEV, ACC] }));
    await openLibrary(ACC);
  }

  async function seeded(seed: number): Promise<string[]> {
    const rand = prng(seed);
    const { pick } = rand;
    const r = rand.next;
    const source = await resetToAccount();
    const accountRows = await seedAccountPhotos(getDb(), rand, (name) => files.add(getAssetFileUri(name, TGT)));
    const problems: string[] = [];
    const { photos: device, errorsGoneTooSoon } = await seedDevicePhotos(
      rand,
      photoOnDevice,
      () => getDb(),
      (name) => files.has(getAssetFileUri(name, TGT)),
    );
    const keeps = r() < 0.3;
    if (keeps) await photoOnDevice({ mediaLibraryAssetId: 'mk', filename: 'kept.jpg', isFileSynced: true });
    const inAlbum = await addToTrip(device);
    let liveDevice = (await source.select().from(schema.assets)).filter((row) => row.deletedAt === null);
    const accountAssets = () => getDb().select().from(schema.assets);

    for (let step = 0; step < 10; step++) {
      problems.push(...(await errorsGoneTooSoon(`seed ${seed}`)));
      const op = r();
      if (op < 0.45) {
        Object.assign(faults, { step: r() < 0.5 ? pick(STEPS) : null, crash: true });
        if (entry('dev')?.mergedInto) await resumeMerges();
        else if (entry('dev')) await mergeLibrary('dev', 'acc').catch(() => {});
        faults.step = null;
        if (faults.dead) await reboot();
      } else if (op < 0.6) {
        await pushAll(getDb());
      } else if (op < 0.7) {
        await pushOlderHalf(getDb());
      } else if (op < 0.75) {
        // Another device purges one of the account's photos (pulled), and this library's sweep runs.
        const [row] = await getDb()
          .select()
          .from(schema.assets)
          .where(eq(schema.assets.id, pick(accountRows).id));
        if (row && row.purgedAt === null) {
          const at = 9500 + step;
          await upsertRows(getDb(), 'assets', schema.assets, [
            { ...row, deletedAt: row.deletedAt ?? at, purgedAt: at, updatedAt: at },
          ]);
        }
        await sweepPurgedFiles(getDb(), purgedFilesRemover(TGT));
      } else if (op < 0.8) {
        await deletedElsewhere(getDb(), pick(accountRows).id, 9000 + step);
      } else if (op < 0.9) {
        const rows = (await accountAssets()).filter((row) => row.deletedAt === null && !row.isFileSynced);
        if (rows.length)
          await repo.update(getDb(), pick(rows).id, {
            isFileSynced: true,
            isThumbnailSynced: true,
            isSynced: true,
          });
      } else if (op < 0.95) {
        // The device library opens again (the session had no tokens) and is edited, unless joined.
        const dev = entry('dev');
        if (dev && !dev.keptFor && !dev.mergedInto?.committed) {
          await closeLibrary();
          await openLibrary(DEV);
          const rows = (await getDb().select().from(schema.assets)).filter((row) => row.deletedAt === null);
          if (rows.length) {
            const photo = pick(rows);
            const edit = r();
            if (edit < 0.3) await repo.update(getDb(), photo.id, { notes: `dev edit ${step}` });
            else if (edit < 0.6) await repo.toggleFavorite(getDb(), photo.id);
            else if (edit < 0.8) await repo.remove(getDb(), [photo.id]);
            else {
              await repo.remove(getDb(), [photo.id]);
              await repo.purgeAssets(getDb(), [photo.id]);
              sweepOpenLibrary();
              await librarySweepsSettled();
            }
          }
          liveDevice = (await getDb().select().from(schema.assets)).filter((row) => row.deletedAt === null);
          await closeLibrary();
          await openLibrary(ACC);
        }
      } else {
        await reboot();
      }
    }

    // The account pushes, then the user edits a photo there (a row after every pass's), at each boot.
    for (let boot = 0; boot < 4 && entry('dev') && !entry('dev')!.keptFor; boot++) {
      await pushAll(getDb());
      await getDb()
        .insert(schema.outbox)
        .values({ collection: 'assets', recordId: `later-${boot}`, op: 'upsert', payload: {}, updatedAt: 1 });
      await resumeMerges();
      const dev = entry('dev');
      if (dev && !dev.mergedInto && !dev.keptFor)
        await mergeLibrary('dev', 'acc').catch((error) => problems.push(`a pass threw ${error}`));
    }
    const at = `seed ${seed}`;
    const kept = liveDevice.some((photo) => photo.filename === 'kept.jpg');
    const dev = entry('dev');
    if (dev && !(kept && dev.keptFor === 'acc' && !dev.mergedInto))
      problems.push(`${at}: the device library stays ${JSON.stringify(dev)}`);
    if (kept && !dev) problems.push(`${at}: the kept device library was removed`);
    const merged = liveDevice.filter((row) => row.filename !== 'kept.jpg');
    problems.push(
      ...(await mergeLosses(getDb(), merged, inAlbum, (name) => files.has(getAssetFileUri(name, TGT)), at)),
    );
    return problems;
  }

  it(`completes, losing nothing, over ${SEEDS} seeds`, async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // the passes made to fail
    const problems: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) problems.push(...(await seeded(seed)));
    vi.mocked(console.warn).mockRestore();
    expect(problems.slice(0, 20)).toEqual([]);
  }, 120_000);
});
