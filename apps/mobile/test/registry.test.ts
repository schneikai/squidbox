import { describe, it, expect, vi, beforeEach } from 'vitest';

const storage = new Map<string, string>();
const writes = { fail: false };
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (writes.fail) throw new Error('disk full');
      storage.set(key, value);
    },
  },
}));

type RegistryModule = typeof import('../src/library/registry');
let registry: RegistryModule;

const device = { id: 'dev-1', owner: { kind: 'device' as const } };
const rebuilt = { libraries: [device] };

describe('registry', () => {
  beforeEach(async () => {
    storage.clear();
    writes.fail = false;
    vi.resetModules();
    registry = await import('../src/library/registry');
  });

  it('a write that fails changes nothing in memory and tells nobody; the next update goes through', async () => {
    await registry.loadRegistry(async () => rebuilt);
    const listener = vi.fn();
    registry.onRegistryChange(listener);
    writes.fail = true;
    await expect(
      registry.updateRegistry(({ libraries }) => ({
        libraries: [...libraries, { id: 'x', owner: { kind: 'device' } }],
      })),
    ).rejects.toThrow('disk full');
    expect(registry.getRegistry()).toEqual(rebuilt);
    expect(listener).not.toHaveBeenCalled();
    writes.fail = false;
    await registry.updateRegistry(({ libraries }) => ({
      libraries: [...libraries, { id: 'y', owner: { kind: 'device' } }],
    }));
    expect(registry.getRegistry().libraries.map((library) => library.id)).toEqual(['dev-1', 'y']);
    expect(JSON.parse(storage.get('libraries')!)).toEqual(registry.getRegistry());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rebuilds and stores the list when there is none', async () => {
    const rebuild = vi.fn(async () => rebuilt);
    expect(await registry.loadRegistry(rebuild)).toEqual(rebuilt);
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.get('libraries')!)).toEqual(rebuilt);
    expect(registry.getRegistry()).toEqual(rebuilt);
  });

  it('loads a stored list without rebuilding', async () => {
    storage.set('libraries', JSON.stringify(rebuilt));
    const rebuild = vi.fn(async () => ({ libraries: [] }));
    expect(await registry.loadRegistry(rebuild)).toEqual(rebuilt);
    expect(rebuild).not.toHaveBeenCalled();
  });

  // The installed build stored a merge marker as the target library's id: it takes that library's
  // account, and goes when the library is gone or its owner has no serverId yet.
  it('loads the installed build’s merge markers with the account of the library they name', async () => {
    const acc = { id: 'acc', owner: { kind: 'account', serverId: 's1', userId: 'u1', email: '' } };
    const unresolved = { id: 'old', owner: { kind: 'account', serverId: null, userId: 'u2', email: '' } };
    const stored = [
      { ...device, mergedInto: 'acc' },
      { id: 'dev-2', owner: { kind: 'device' }, mergedInto: 'gone' },
      { id: 'dev-3', owner: { kind: 'device' }, mergedInto: 'old' },
      acc,
      unresolved,
    ];
    storage.set('libraries', JSON.stringify({ libraries: stored }));
    const { libraries } = await registry.loadRegistry(async () => ({ libraries: [] }));
    expect(libraries.slice(0, 3)).toEqual([
      { ...device, mergedInto: { library: 'acc', serverId: 's1', userId: 'u1' } },
      { id: 'dev-2', owner: { kind: 'device' } },
      { id: 'dev-3', owner: { kind: 'device' } },
    ]);
  });

  it('moves a value that does not parse aside and rebuilds', async () => {
    storage.set('libraries', '{"libraries": [{"id": 1}]');
    expect(await registry.loadRegistry(async () => rebuilt)).toEqual(rebuilt);
    const aside = [...storage.keys()].find((key) => key.startsWith('libraries.corrupt-'));
    expect(storage.get(aside!)).toBe('{"libraries": [{"id": 1}]');
    expect(JSON.parse(storage.get('libraries')!)).toEqual(rebuilt);
  });

  it('a value with the wrong shape counts as corrupt too', async () => {
    storage.set('libraries', JSON.stringify({ libraries: [{ id: 'x' }] }));
    expect(await registry.loadRegistry(async () => rebuilt)).toEqual(rebuilt);
  });

  it('serializes concurrent updates so none is lost', async () => {
    await registry.loadRegistry(async () => ({ libraries: [] }));
    const add = (id: string) =>
      registry.updateRegistry(({ libraries }) => ({ libraries: [...libraries, { id, owner: { kind: 'device' } }] }));
    await Promise.all([add('a'), add('b'), add('c')]);
    expect(registry.getRegistry().libraries.map((library) => library.id)).toEqual(['a', 'b', 'c']);
    expect(JSON.parse(storage.get('libraries')!)).toEqual(registry.getRegistry());
  });

  it('updateLibrary changes one library, and writes nothing when the change changes nothing', async () => {
    await registry.loadRegistry(async () => ({ libraries: [device, { id: 'other', owner: { kind: 'device' } }] }));
    const owner = { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'a@b.co' };
    const next = await registry.updateLibrary('dev-1', (library) => ({ ...library, owner }));
    expect(next.libraries).toEqual([
      { id: 'dev-1', owner },
      { id: 'other', owner: { kind: 'device' } },
    ]);
    storage.set('libraries', 'untouched');
    await registry.updateLibrary('dev-1', (library) => library);
    await registry.updateLibrary('missing', (library) => ({ ...library, owner }));
    await registry.updateRegistry((current) => current);
    expect(storage.get('libraries')).toBe('untouched');
  });

  it('getRegistry throws before the list is loaded', () => {
    expect(() => registry.getRegistry()).toThrow('not loaded');
  });
});
