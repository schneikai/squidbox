// One persisted JSON value: an in-memory copy loaded once at boot, changed only through `update`
// on a promise chain (so no writer overwrites another's change from a stale copy), written first
// (a failed write changes nothing in memory), and announced to subscribers after every change.
export function createPersistedStore<T>({ name, write }: { name: string; write: (value: T) => Promise<void> }) {
  let value: T | undefined;
  let chain: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(value: T) => void>();

  function notify() {
    for (const listener of listeners) listener(value as T);
  }

  function get(): T {
    if (value === undefined) throw new Error(`${name} is not loaded yet (see LibraryProvider).`);
    return value;
  }

  return {
    get,
    async load(read: () => Promise<T>): Promise<T> {
      value = await read();
      notify();
      return value;
    },
    // Null before the boot loaded it (for a render that happens before).
    snapshot(): T | null {
      return value === undefined ? null : value;
    },
    // `change` returns the same value for no change, which writes nothing.
    update(change: (current: T) => T): Promise<T> {
      const next = chain.then(async () => {
        const changed = change(get());
        if (changed === value) return changed;
        await write(changed);
        value = changed;
        notify();
        return value;
      });
      chain = next.catch(() => {});
      return next;
    },
    subscribe(listener: (value: T) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
