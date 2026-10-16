import { describe, it, expect, vi, beforeEach } from 'vitest';

// Web's expo-sqlite, faked: which files exist and whether they hold the migrations table.
const files = new Map<string, { migrated: boolean }>();
const calls: string[] = [];
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: async (name: string) => {
    calls.push(`open ${name}`);
    if (!files.has(name)) files.set(name, { migrated: false }); // opening creates the file
    return {
      getFirstAsync: async () => (files.get(name)!.migrated ? { name: '__drizzle_migrations' } : null),
      closeAsync: async () => {
        calls.push(`close ${name}`);
      },
    };
  },
}));
vi.mock('../src/sync/db/client', () => ({
  deleteAppDb: async (name: string) => {
    calls.push(`delete ${name}`);
    files.delete(name);
  },
}));

const { libraryLimitMessage, listDatabaseNames } = await import('../src/library/fs.web');

describe('listDatabaseNames (web probe)', () => {
  beforeEach(() => {
    files.clear();
    calls.length = 0;
  });

  it('finds a migrated squidbox.db', async () => {
    files.set('squidbox.db', { migrated: true });
    expect(await listDatabaseNames()).toEqual(['squidbox.db']);
    expect(calls).toEqual(['open squidbox.db', 'close squidbox.db']);
    expect(files.has('squidbox.db')).toBe(true);
  });

  it('leaves no file behind on a fresh install', async () => {
    expect(await listDatabaseNames()).toEqual([]);
    expect(calls).toEqual(['open squidbox.db', 'close squidbox.db', 'delete squidbox.db']);
    expect(files.size).toBe(0);
  });
});

// The messages a full OPFS pool gives, as headless Chromium showed them through expo-sqlite's worker.
describe('libraryLimitMessage (web)', () => {
  it('recognizes a database file or a journal that got no slot', () => {
    expect(libraryLimitMessage(new Error('Error: sqlite3_open_v2'))).toMatch(/^This browser/);
    expect(libraryLimitMessage(new Error('Error: Error code 14: unable to open database file'))).toMatch(
      /^This browser/,
    );
  });

  it('leaves any other failure alone', () => {
    expect(libraryLimitMessage(new Error('Error: Error code 1: no such table: assets'))).toBeNull();
    expect(libraryLimitMessage('sqlite3_open_v2')).toBeNull();
  });
});
