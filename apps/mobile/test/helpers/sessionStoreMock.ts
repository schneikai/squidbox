import type { Session } from '../../src/library/session';

// The session store, in memory, for tests that mock '../src/utils/cloud-api/sessionStore':
// `vi.mock(path, () => sessionStoreMock(store))` with `store.session` as the record.
export function sessionStoreMock(store: { session: Session | null; writes?: number }) {
  return {
    getSession: () => store.session,
    loadSessionAsync: async () => store.session,
    onSessionChange: () => () => {},
    updateSession: async (change: (session: Session | null) => Session | null) => {
      const next = change(store.session);
      if (next !== store.session) {
        store.session = next;
        store.writes = (store.writes ?? 0) + 1;
      }
      return store.session;
    },
  };
}
