/**
 * A value that subscribers hear about on each change, for useSyncExternalStore: `get()` (the same
 * object until it changes), `set(next)` or `set((current) => next)`, and `subscribe(listener)`, which
 * returns the unsubscribe.
 */
export default function createStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? next(value) : next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
