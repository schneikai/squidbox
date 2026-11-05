import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The live query, the app database and the catalog need Expo, which doesn't load in node: the hooks
// render on the server with the library and the live query replaced, and each read they pass is run
// against a database that fails on any use.
const reads = vi.hoisted(() => [] as Promise<unknown>[]);
const untouchable = vi.hoisted(
  () =>
    new Proxy(
      {},
      {
        get: () => {
          throw new Error('read the database');
        },
      },
    ),
);
vi.mock('../src/sync/useLiveQuery', () => ({
  useLiveQuery: (read: (db: unknown) => Promise<unknown>) => {
    reads.push(read(untouchable));
    return undefined;
  },
}));
vi.mock('../src/sync/db/client', async () => ({
  schema: await import('../src/sync/db/schema'),
  getDb: () => untouchable,
}));
vi.mock('../src/library/useLibrary', () => ({
  default: () => ({ library: { id: 'device', owner: { kind: 'device' } }, paths: {} }),
}));
vi.mock('../src/hooks/useAiCatalog', () => ({
  default: () => ({ models: null, defaults: null, instructions: null, error: null, retry: () => {} }),
}));
vi.mock('../src/hooks/useHasFeature', () => ({ default: () => false }));
vi.mock('../src/sync/worker', () => ({ requestSync: () => {} }));

const { default: usePersona } = await import('../src/hooks/usePersona');
const { default: useInstructions } = await import('../src/hooks/useInstructions');
const { default: useYourDefaults } = await import('../src/hooks/useYourDefaults');

describe("the Assistant's per-account hooks in this device's library", () => {
  it('render without an account and read nothing, so a screen opened there can still go back', async () => {
    function Probe() {
      usePersona();
      useInstructions();
      useYourDefaults();
      return null;
    }
    expect(() => renderToString(createElement(Probe))).not.toThrow();
    await expect(Promise.all(reads)).resolves.toEqual([null, null, null]);
  });
});
