import createStore from '@/lib/createStore';

// The open quick view, or `null`: `{ asset, routeKey, owner }`, the photo peeked at, the sheet its
// grid lives in (`null` in the main app), so only that surface's QuickViewHost shows it, and the
// grid that opened it, so only that grid closes it.
const store = createStore(null);

/**
 * The quick view: `open(asset, { routeKey, owner })` shows a peek, `close(owner)` closes it if
 * `owner` opened it (anything else leaves it, and nothing is notified), and `get()` and
 * `subscribe(listener)`, for useSyncExternalStore.
 */
const quickViewStore = {
  open: (asset, { routeKey, owner }) => store.set({ asset, routeKey, owner }),
  close(owner) {
    if (store.get()?.owner === owner) store.set(null);
  },
  get: store.get,
  subscribe: store.subscribe,
};

export default quickViewStore;
