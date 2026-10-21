import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import { libraryPaths } from '../src/library/libraryPaths';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import getAssetFileUri from '../src/utils/assets/files/getAssetFileUri';

// Round 6: a merge pass (mergeRun.ts) failing, or the app dying, at each of its steps, then the
// device library opened again while the session is lost (its photo purged there, its open-sweep
// run), then the boot's resume. The invariant (sync-design §7a, §8): a device photo whose record an
// account library holds keeps a file somewhere (the device library's folder or the account's) while
// its purge can still lose in the account; and a merge that completes leaves no marker.

const stores = new Map<string, AppDb>();
const files = new Set<string>();
const storage = new Map<string, string>();
// The step that fails, and whether the process dies there (nothing after it runs, no catch block).
const inject = vi.hoisted(() => ({
  step: null as string | null,
  crash: false,
  dead: false,
  sweepDelay: 0,
  onRemoved: null as (() => void) | null,
}));
function reach(step: string) {
  if (inject.step !== step) return;
  inject.step = null;
  if (inject.crash) inject.dead = true;
  throw new Error(`failed at ${step}`);
}

vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/sync/db/client', () => {
  let open: AppDb | null = null;
  const openAppDb = async (name: string) => {
    if (!stores.has(name)) stores.set(name, makeTestDb());
    return Object.assign(Object.create(stores.get(name)!), { close: async () => {} });
  };
  return {
    openAppDb,
    withAppDb: async (name: string, use: (db: AppDb) => Promise<unknown>) => use(await openAppDb(name)),
    deleteAppDb: async (name: string) => {
      if (inject.dead) return;
      reach('deleteDb');
      stores.delete(name);
    },
    getDb: () => open!,
    setOpenDb: (db: AppDb | null) => {
      open = db;
    },
  };
});
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (inject.dead) return;
      storage.set(key, value);
    },
  },
}));
vi.mock('../src/library/fs', () => ({
  listFiles: async (dir: string) =>
    new Set([...files].filter((uri) => uri.startsWith(dir)).map((uri) => uri.slice(dir.length))),
  fileExists: async (uri: string) => files.has(uri),
  moveFile: async (from: string, to: string) => {
    reach('move');
    files.delete(from);
    files.add(to);
  },
  removeLibraryFolders: async () => {},
  purgedFilesRemover:
    (paths: { filesDir: string; thumbnailsDir: string }) =>
    async (names: { filename?: string; thumbnailFilename?: string }[]) => {
      if (inject.sweepDelay) await new Promise((resolve) => setTimeout(resolve, inject.sweepDelay));
      for (const { filename, thumbnailFilename } of names) {
        if (filename) files.delete(`file:///docs/${paths.filesDir}${filename}`);
        if (thumbnailFilename) files.delete(`file:///docs/${paths.thumbnailsDir}${thumbnailFilename}`);
      }
      inject.onRemoved?.();
    },
}));
vi.mock('../src/sync/status', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/sync/status')>();
  return {
    ...original,
    getMergeTarget: async (...args: Parameters<typeof original.getMergeTarget>) => {
      reach('readMarker');
      return original.getMergeTarget(...args);
    },
    setMergeTarget: async (db: Parameters<typeof original.setMergeTarget>[0], target: string | null) => {
      if (inject.dead) return;
      reach(target ? 'setMarker' : 'clearMarker');
      return original.setMergeTarget(db, target);
    },
  };
});
vi.mock('../src/library/mergeLibrary', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/library/mergeLibrary')>();
  return {
    ...original,
    planMerge: async (...args: Parameters<typeof original.planMerge>) => {
      reach('plan');
      return original.planMerge(...args);
    },
    applyMerge: async (...args: Parameters<typeof original.applyMerge>) => {
      reach('apply');
      await original.applyMerge(...args);
      reach('afterCommit'); // the transaction committed, and its promise still rejects
    },
  };
});
vi.mock('../src/library/registry', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/library/registry')>();
  return {
    ...original,
    updateLibrary: async (...args: Parameters<typeof original.updateLibrary>) => {
      if (inject.dead) return original.getRegistry();
      const before = original.getRegistry().libraries.find((library) => library.id === args[0]);
      const after = args[1](before!);
      reach(after.mergedInto ? 'listMarker' : after.keptFor ? 'listKept' : 'listClear');
      return original.updateLibrary(...args);
    },
  };
});

const { closeLibrary, openLibrary, openLibraryId } = await import('../src/library/current');
const { getRegistry, loadRegistry } = await import('../src/library/registry');
const { mergeLibrary, resumeMerges } = await import('../src/library/mergeRun');
const { getDb } = await import('../src/sync/db/client');
const status = await import('../src/sync/status');

const DEV = { id: 'dev', owner: { kind: 'device' as const } };
const ACC = { id: 'acc', owner: { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'u1@test' } };
const SRC = libraryPaths('dev');
const TGT = libraryPaths('acc');
const entry = (id: string) => getRegistry().libraries.find((library) => library.id === id);
const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

const reached = new Set<string>();
const STEPS = [
  'listMarker',
  'readMarker',
  'plan',
  'setMarker',
  'apply',
  'afterCommit',
  'move',
  'clearMarker',
  'listKept',
  'deleteDb',
  'listClear',
];

async function devicePhoto(db: AppDb, over: Record<string, unknown>) {
  const asset = await repo.createAsset(
    db,
    makeAssetRecord({ isFileSynced: false, isThumbnailSynced: false, isSynced: false, ...over }),
  );
  if (!asset.isFileSynced) files.add(getAssetFileUri(asset.filename, SRC));
  return asset;
}

// One scenario: a failure (or a crash) at `step` of the first pass, the device library opened while
// the session is lost and the photo purged there, then boots until the merge completes. Returns the
// invariant's violations.
async function scenario(step: string, crash: boolean, keepsSource: boolean): Promise<string[]> {
  const problems: string[] = [];
  const at = `${crash ? 'crash' : 'throw'} at ${step}${keepsSource ? ', source kept' : ''}`;
  reached.add(at);
  if (openLibraryId()) await closeLibrary();
  stores.clear();
  files.clear();
  storage.clear();
  Object.assign(inject, { step: null, crash: false, dead: false });
  await loadRegistry(async () => ({ libraries: [DEV, ACC] }));
  stores.set(SRC.dbName, makeTestDb());
  const photo = await devicePhoto(stores.get(SRC.dbName)!, { filename: 'p.jpg', mediaLibraryAssetId: 'm-p' });
  if (keepsSource)
    await devicePhoto(stores.get(SRC.dbName)!, {
      filename: 'cloud.jpg',
      mediaLibraryAssetId: 'm-c',
      isFileSynced: true,
    });
  await openLibrary(ACC);
  await status.markFirstSyncDone(getDb());

  const hasFile = () => files.has(getAssetFileUri('p.jpg', SRC)) || files.has(getAssetFileUri('p.jpg', TGT));
  const inAccount = async () =>
    (await stores.get(TGT.dbName)!.select().from(schema.assets)).some((row) => row.id === photo.id);

  Object.assign(inject, { step, crash });
  await mergeLibrary('dev', 'acc').catch(() => {});
  if (inject.step === step) {
    reached.delete(at); // this pass never reaches the step (e.g. no source kept: no clearMarker)
    return [];
  }
  inject.dead = false;

  // The session is lost: the device library opens (its open sweeps), and the photo is purged there.
  if (entry('dev')) {
    await closeLibrary();
    await openLibrary(DEV);
    await repo.deleteAssets(getDb(), [photo.id]);
    await repo.purgeAssets(getDb(), [photo.id]);
    const { sweepOpenLibrary } = await import('../src/library/current');
    sweepOpenLibrary();
    await settled();
    if ((await inAccount()) && !hasFile())
      problems.push(`${at}: the account holds the photo, but the device purge removed its only file`);
    await closeLibrary();
    await openLibrary(ACC);
  }

  // Boots, signed in: the resume, then this device's library joins (mergeDeviceLibrary's conditions).
  for (let boot = 0; boot < 2; boot++) {
    await resumeMerges();
    const dev = entry('dev');
    if (dev && !dev.mergedInto && !dev.keptFor) await mergeLibrary('dev', 'acc');
  }
  const dev = entry('dev');
  if (dev?.mergedInto) problems.push(`${at}: the list's marker stays after the merge completed`);
  if (stores.has(SRC.dbName) && dev && (await status.getMergeTarget(stores.get(SRC.dbName)!)))
    problems.push(`${at}: the source's marker stays after the merge completed`);
  if ((await inAccount()) && !hasFile()) problems.push(`${at}: the account holds the photo without its file`);
  return problems;
}

describe('a merge pass failing or crashing at each step, then a purge on the device, then the resume', () => {
  beforeEach(() => {
    Object.assign(inject, { step: null, crash: false, dead: false });
  });

  it('a crash at any step: the photo keeps a file while the account can restore it, and the merge completes clean', async () => {
    const problems: string[] = [];
    for (const keepsSource of [false, true])
      for (const step of STEPS) problems.push(...(await scenario(step, true, keepsSource)));
    expect(problems).toEqual([]);
    expect([...reached].filter((at) => at.startsWith('crash'))).toHaveLength(9 + 8); // the steps each shape reaches
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
    expect([...reached].filter((at) => at.startsWith('throw'))).toHaveLength(7 + 8); // the steps each shape reaches
  });
});

// Round 6: the device library's open-sweep still running when the sign-in switches to the account's
// library and the merge starts. closeLibrary aborts it (between batches) and closes its database, so
// a batch in flight can still remove its files but marks nothing; the merge then copies the live
// photos with their files, and leaves the purged ones (gone from the device for good) behind.
describe('a device library’s sweep running when the sign-in merges it', () => {
  it('stops at the switch, never touches a live photo’s file, and the merge completes', async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    files.clear();
    storage.clear();
    await loadRegistry(async () => ({ libraries: [DEV, ACC] }));
    const source = makeTestDb();
    stores.set(SRC.dbName, source);
    const purged = await repo.createAssets(
      source,
      Array.from({ length: 2000 }, (_, i) =>
        makeAssetRecord({ filename: `gone${i}.jpg`, thumbnailFilename: `gone${i}-t.jpg`, isFileSynced: false }),
      ),
    );
    for (const asset of purged) files.add(getAssetFileUri(asset.filename, SRC));
    await repo.deleteAssets(
      source,
      purged.map((a) => a.id),
    );
    await repo.purgeAssets(
      source,
      purged.map((a) => a.id),
    );
    // A live photo sharing a purged one's name, and one of its own.
    const sharing = await devicePhoto(source, { filename: 'gone7.jpg', mediaLibraryAssetId: 'm-s' });
    const own = await devicePhoto(source, { filename: 'own.jpg', mediaLibraryAssetId: 'm-o' });

    inject.sweepDelay = 30; // each batch's removal takes a while
    const firstBatch = new Promise<void>((resolve) => (inject.onRemoved = resolve));
    await openLibrary(DEV); // its sweep starts, without holding up the open
    await firstBatch;
    inject.onRemoved = null;
    const left = () => [...files].filter((uri) => uri.startsWith(getAssetFileUri('gone', SRC))).length;
    // The sign-in: the switch closes the device library, then its records join the account's.
    await closeLibrary();
    await openLibrary(ACC);
    await status.markFirstSyncDone(getDb());
    await mergeLibrary('dev', 'acc');
    await new Promise((resolve) => setTimeout(resolve, 100)); // a batch in flight at the switch finishes
    inject.sweepDelay = 0;
    // The sweep stopped at the switch (a second batch at most): the rest goes with the source's folders.
    expect(left()).toBeGreaterThanOrEqual(2000 - 2 * 500 - 1);

    const inAccount = (await getDb().select().from(schema.assets)).map((row) => row.id).sort();
    expect(inAccount).toEqual([sharing.id, own.id].sort()); // the purged ones stay behind
    expect(files.has(getAssetFileUri('gone7.jpg', TGT))).toBe(true);
    expect(files.has(getAssetFileUri('own.jpg', TGT))).toBe(true);
    expect(entry('dev')).toBeUndefined();
  });
});
