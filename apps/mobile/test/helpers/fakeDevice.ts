import { vi } from 'vitest';

import { makeTestDb } from './testDb';
import type * as MergeLibrary from '../../src/library/mergeLibrary';
import type { AppDb } from '../../src/sync/db/driver';
import * as schema from '../../src/sync/db/schema';

/**
 * One fake device for the library tests that mock its modules (mergeRun, mergeRunFailures,
 * accountSwitch, removeLibrary): databases by name (a store survives close and reopen, like a file),
 * files by uri, AsyncStorage, and the faults a test sets. A test file mocks a module with
 * `vi.mock(path, async () => (await import('./helpers/fakeDevice')).dbClient())` and so on, and calls
 * `resetDevice()` between tests.
 */
export const stores = new Map<string, AppDb>();
export const files = new Set<string>();
export const storage = new Map<string, string>();
/** The databases deleted, by name, in order. */
export const deleted: string[] = [];
/** The database files on disk, for a library list rebuilt from them. */
export const dbNames: string[] = [];

const defaults = () => ({
  step: null as string | null, // the step that fails (reach)
  crash: false, // the process dies at that step: nothing after it writes
  dead: false,
  failApply: false, // applyMerge throws before it writes
  removing: null as (() => Promise<void>) | null, // what each removal of purged files waits for
  autoPush: false, // the account's library pushes right after each commit
});
export const faults = {
  ...defaults(),
  failingOpens: new Set<string>(), // databases that can't be opened
  fullOpens: new Set<string>(), // databases the browser has no room for (web's fixed pool of files)
  failingMoves: new Set<string>(), // file moves and copies that throw, by source uri
};

/** Fails at `step` when the test named it there, once; with `crash`, the device is dead from then on. */
export function reach(step: string): void {
  if (faults.step !== step) return;
  faults.step = null;
  if (faults.crash) faults.dead = true;
  throw new Error(`failed at ${step}`);
}

/** Back to an empty device with no faults. */
export function resetDevice(): void {
  stores.clear();
  files.clear();
  storage.clear();
  deleted.length = 0;
  dbNames.length = 0;
  Object.assign(faults, defaults());
  faults.failingOpens.clear();
  faults.fullOpens.clear();
  faults.failingMoves.clear();
}

/** The mock of `src/sync/db/client`. */
export function dbClient() {
  let open: AppDb | null = null;
  const openAppDb = async (name: string) => {
    if (faults.failingOpens.has(name)) throw new Error(`cannot open ${name}`);
    if (faults.fullOpens.has(name)) throw new Error(`no room for ${name}`);
    if (!stores.has(name)) stores.set(name, makeTestDb());
    return Object.assign(Object.create(stores.get(name)!), { close: async () => {} }) as AppDb;
  };
  return {
    openAppDb,
    withAppDb: async (name: string, use: (db: AppDb) => Promise<unknown>) => use(await openAppDb(name)),
    deleteAppDb: async (name: string) => {
      if (faults.dead) return;
      reach('deleteDb');
      deleted.push(name);
      stores.delete(name);
    },
    getDb: () => {
      if (!open) throw new Error('No library is open');
      return open;
    },
    setOpenDb: (db: AppDb | null) => {
      open = db;
    },
  };
}

/** The mock of `@react-native-async-storage/async-storage`. */
export function asyncStorage() {
  return {
    default: {
      getItem: async (key: string) => storage.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        if (faults.dead) return;
        storage.set(key, value);
      },
    },
  };
}

/** The mock of `src/library/fs`, on `files`. */
export function libraryFs() {
  return {
    listDatabaseNames: async () => dbNames,
    listFiles: async (dir: string) =>
      new Set([...files].filter((uri) => uri.startsWith(dir)).map((uri) => uri.slice(dir.length))),
    fileExists: async (uri: string) => files.has(uri),
    moveFile: async (from: string, to: string) => {
      reach('move');
      if (faults.failingMoves.has(from)) throw new Error(`could not move ${from}`);
      files.delete(from);
      files.add(to);
    },
    copyFile: async (from: string, to: string) => {
      reach('move');
      if (faults.failingMoves.has(from)) throw new Error(`could not copy ${from}`);
      files.add(to);
    },
    createLibraryFolders: async () => {},
    removeLibraryFolders: async () => {},
    libraryLimitMessage: (error: Error) => (error.message.startsWith('no room') ? 'No more libraries' : null),
    // A device library's sweep (current.ts sweepOpenLibrary).
    purgedFilesRemover:
      (paths: { filesDir: string; thumbnailsDir: string }) =>
      async (names: { filename?: string; thumbnailFilename?: string }[]) => {
        await faults.removing?.();
        for (const { filename, thumbnailFilename } of names) {
          if (filename) files.delete(`file:///docs/${paths.filesDir}${filename}`);
          if (thumbnailFilename) files.delete(`file:///docs/${paths.thumbnailsDir}${thumbnailFilename}`);
        }
      },
  };
}

/** `src/library/mergeLibrary` with the faults: planMerge and applyMerge as `vi.fn`s that reach their steps. */
export function mergeLibraryWithFaults(original: typeof MergeLibrary) {
  return {
    ...original,
    planMerge: vi.fn(async (...args: Parameters<typeof original.planMerge>) => {
      reach('plan');
      return original.planMerge(...args);
    }),
    applyMerge: vi.fn(async (...args: Parameters<typeof original.applyMerge>) => {
      if (faults.failApply) throw new Error('apply failed');
      reach('apply');
      const commit = await original.applyMerge(...args);
      reach('afterCommit'); // the transaction committed, and its promise still rejects
      if (faults.autoPush) await args[0].delete(schema.outbox); // so the pass goes on to finish
      return commit;
    }),
  };
}
