const BATCH_SIZE = 12; // thumbnails presigned + fetched per load (one presign call per batch)
const MAX_ACTIVE_BATCHES = 2; // hard cap on batches in flight at once
const RETRY_DELAY = 5000; // ms before the failed thumbnails of a batch are tried again
const MAX_RETRIES = 3; // then they're reported failed
const RECOVERY_INTERVAL = 60000; // ms between second chances for the failed ones still in view

type LoadResult = 'done' | 'failed';
type Listener = (result: LoadResult) => void;
type RequestState = 'queued' | 'loading' | 'waiting' | 'failed';
type Entry<Item> = { asset: Item; listeners: Set<Listener>; failures: number; state: RequestState };

type ThumbnailQueueOptions<Item> = {
  load: (items: Item[], signal: AbortSignal) => Promise<Set<string>>;
  onError: (error: unknown) => void;
  keyOf: (item: Item) => string;
};

// The loader's queue, without React. `request(asset, onResult)` returns a withdraw function and calls
// `onResult` with 'done', or 'failed' once its retries ran out (a failed one gets another chance on
// sign-in, `retryFailed` and every minute while it's still asked for). Only requests someone still
// listens to are kept, the newest (or the one asked for again) loading first, in batches behind a
// hard cap. `load(assets, signal)` resolves the names of those it has on the device afterwards and
// throws when the whole batch failed; `dispose` drops everything and aborts what's in flight.
// `keyOf(item)` names an item's file (an asset's thumbnail, a contact's avatar).
export default function createThumbnailQueue<Item>({ load, onError, keyOf }: ThumbnailQueueOptions<Item>) {
  let requests = new Map<string, Entry<Item>>(); // by keyOf
  let stack: string[] = []; // the keys of the 'queued' requests, the newest last
  let activeBatches = 0;
  let isEnabled = false;
  let controller = new AbortController(); // aborted by dispose, for the batches in flight
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let recoveryTimer: ReturnType<typeof setInterval> | null = null;

  // A key's request; one the queue no longer has is a bug.
  function entryOf(key: string): Entry<Item> {
    const entry = requests.get(key);
    if (!entry) throw new Error(`Thumbnail ${key} has no request`);
    return entry;
  }

  function request(asset: Item, onResult: Listener): () => void {
    const key = asset && keyOf(asset);
    if (!key) return () => {};
    let entry = requests.get(key);
    if (!entry) {
      entry = { asset, listeners: new Set(), failures: 0, state: 'queued' };
      requests.set(key, entry);
      stack.push(key);
    } else if (entry.state !== 'loading') {
      // Asked for again: to the top, whether it was queued, waiting for its retry or failed.
      if (entry.state === 'queued') unstack(key);
      if (entry.state === 'failed') entry.failures = 0;
      entry.state = 'queued';
      stack.push(key);
    }
    entry.listeners.add(onResult);
    pump();
    return () => withdraw(key, onResult);
  }

  function withdraw(key: string, onResult: Listener) {
    const entry = requests.get(key);
    if (!entry?.listeners.delete(onResult)) return;
    // A batch in flight can't be called back; it forgets the key once it settles.
    if (entry.listeners.size > 0 || entry.state === 'loading') return;
    unstack(key);
    requests.delete(key);
  }

  function unstack(key: string) {
    const index = stack.indexOf(key);
    if (index !== -1) stack.splice(index, 1);
  }

  function pump() {
    while (isEnabled && activeBatches < MAX_ACTIVE_BATCHES && stack.length > 0) {
      const keys = stack.splice(-BATCH_SIZE).reverse(); // newest-requested first
      for (const key of keys) entryOf(key).state = 'loading';
      activeBatches += 1;
      loadBatch(keys);
    }
  }

  async function loadBatch(keys: string[]) {
    const { signal } = controller;
    let available: Set<string> | null = null; // null: the whole batch failed, which counts against no key
    try {
      available = await load(
        keys.map((key) => entryOf(key).asset),
        signal,
      );
    } catch (error) {
      if (!signal.aborted) onError(error);
    }
    if (signal.aborted) return; // disposed meanwhile
    activeBatches -= 1;
    const retries = keys
      .filter((key) => settle(key, available))
      .map((key): [string, Entry<Item>] => [key, entryOf(key)]);
    if (retries.length > 0) later(() => retry(retries), RETRY_DELAY);
    pump();
  }

  // Resolves whether the key is to be tried again.
  function settle(key: string, available: Set<string> | null): boolean {
    const entry = entryOf(key);
    if (entry.listeners.size === 0) {
      requests.delete(key);
      return false;
    }
    if (available?.has(key)) {
      requests.delete(key);
      tell(entry, 'done');
      return false;
    }
    if (available) entry.failures += 1;
    if (entry.failures <= MAX_RETRIES) {
      entry.state = 'waiting';
      return true;
    }
    entry.state = 'failed';
    onError(new Error(`Thumbnail ${key} failed to load`));
    recoveryTimer ??= setInterval(retryFailed, RECOVERY_INTERVAL);
    tell(entry, 'failed');
    return false;
  }

  function tell(entry: Entry<Item>, result: LoadResult) {
    for (const listener of [...entry.listeners]) listener(result);
  }

  // Retries yield to the requests made meanwhile: they go to the bottom of the stack. One withdrawn
  // or asked for again meanwhile is no longer this retry's.
  function retry(retries: [string, Entry<Item>][]) {
    const due = retries.filter(([key, entry]) => requests.get(key) === entry && entry.state === 'waiting');
    requeue(due);
  }

  function requeue(entries: [string, Entry<Item>][]) {
    for (const [, entry] of entries) entry.state = 'queued';
    stack.unshift(...entries.map(([key]) => key).reverse());
    pump();
  }

  // A second chance for the failed requests still listened to (sign-in, foreground, every minute).
  function retryFailed() {
    if (recoveryTimer) clearInterval(recoveryTimer);
    recoveryTimer = null;
    const failed = [...requests].filter(([, entry]) => entry.state === 'failed');
    for (const [, entry] of failed) entry.failures = 0;
    requeue(failed);
  }

  function later(run: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, delay);
    timers.add(timer);
  }

  // Requests wait while nobody is signed in and load once someone is.
  function setEnabled(enabled: boolean) {
    const wasEnabled = isEnabled;
    isEnabled = enabled;
    if (enabled && !wasEnabled) retryFailed();
    else pump();
  }

  // The provider went away (a library switch): nothing in flight may report or write any more.
  function dispose() {
    isEnabled = false;
    controller.abort();
    controller = new AbortController();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    if (recoveryTimer) clearInterval(recoveryTimer);
    recoveryTimer = null;
    requests = new Map();
    stack = [];
    activeBatches = 0;
  }

  return { request, setEnabled, retryFailed, dispose };
}
