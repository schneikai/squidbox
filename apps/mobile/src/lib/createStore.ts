/**
 * A value that subscribers hear about on each change, for useSyncExternalStore: `get()` (the same
 * object until it changes), `set(next)` or `set((current) => next)`, and `subscribe(listener)`, which
 * returns the unsubscribe.
 */
export type Store<T> = {
  get: () => T;
  set: (next: T | ((current: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
};

export default function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      // A function is always an updater: no store holds a function as its value.
      value = typeof next === 'function' ? (next as (current: T) => T)(value) : next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
