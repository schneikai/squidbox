import type { SyncTransport } from '../../src/sync/transport';

// A server that applies every push and has nothing new to pull; `over` replaces either side.
export function fakeTransport(over: Partial<SyncTransport> = {}): SyncTransport {
  return {
    push: async (req) => ({
      results: req.mutations.map((m) => ({ id: String(m.record.id), collection: m.collection, status: 'applied' })),
    }),
    pull: async ({ cursor }) => ({ changes: {}, cursor, hasMore: false }),
    ...over,
  };
}
