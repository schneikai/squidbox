const BATCH_SIZE = 12; // thumbnails presigned + fetched per load (one presign call per batch)
const MAX_ACTIVE_BATCHES = 2; // hard cap on batches in flight at once
const RETRY_DELAY = 5000; // ms before the failed thumbnails of a batch are tried again
const MAX_RETRIES = 3; // then they're reported failed
const RECOVERY_INTERVAL = 60000; // ms between second chances for the failed ones still in view

// The loader's queue, without React. `request(asset, onResult)` returns a withdraw function and calls
// `onResult` with 'done', or 'failed' once its retries ran out (a failed one gets another chance on
// sign-in, `retryFailed` and every minute while it's still asked for). Only requests someone still
// listens to are kept, the newest (or the one asked for again) loading first, in batches behind a
// hard cap. `load(assets, signal)` resolves the names of those it has on the device afterwards and
// throws when the whole batch failed; `dispose` drops everything and aborts what's in flight.
export default function createThumbnailQueue({ load, onError }) {
  // by thumbnailFilename: { asset, listeners, failures, state: 'queued' | 'loading' | 'waiting' | 'failed' }
  let requests = new Map();
  let stack = []; // the keys of the 'queued' requests, the newest last
  let activeBatches = 0;
  let isEnabled = false;
  let controller = new AbortController(); // aborted by dispose, for the batches in flight
  const timers = new Set();
  let recoveryTimer = null;

  function request(asset, onResult) {
    const key = asset?.thumbnailFilename;
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

  function withdraw(key, onResult) {
    const entry = requests.get(key);
    if (!entry?.listeners.delete(onResult)) return;
    // A batch in flight can't be called back; it forgets the key once it settles.
    if (entry.listeners.size > 0 || entry.state === 'loading') return;
    unstack(key);
    requests.delete(key);
  }

  function unstack(key) {
    const index = stack.indexOf(key);
    if (index !== -1) stack.splice(index, 1);
  }

  function pump() {
    while (isEnabled && activeBatches < MAX_ACTIVE_BATCHES && stack.length > 0) {
      const keys = stack.splice(-BATCH_SIZE).reverse(); // newest-requested first
      for (const key of keys) requests.get(key).state = 'loading';
      activeBatches += 1;
      loadBatch(keys);
    }
  }

  async function loadBatch(keys) {
    const { signal } = controller;
    let available = null; // null: the whole batch failed, which counts against no key
    try {
      available = await load(
        keys.map((key) => requests.get(key).asset),
        signal,
      );
    } catch (error) {
      if (!signal.aborted) onError?.(error);
    }
    if (signal.aborted) return; // disposed meanwhile
    activeBatches -= 1;
    const retries = keys.filter((key) => settle(key, available)).map((key) => [key, requests.get(key)]);
    if (retries.length > 0) later(() => retry(retries), RETRY_DELAY);
    pump();
  }

  // Resolves whether the key is to be tried again.
  function settle(key, available) {
    const entry = requests.get(key);
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
    onError?.(new Error(`Thumbnail ${key} failed to load`));
    recoveryTimer ??= setInterval(retryFailed, RECOVERY_INTERVAL);
    tell(entry, 'failed');
    return false;
  }

  function tell(entry, result) {
    for (const listener of [...entry.listeners]) listener(result);
  }

  // Retries yield to the requests made meanwhile: they go to the bottom of the stack. One withdrawn
  // or asked for again meanwhile is no longer this retry's.
  function retry(retries) {
    const due = retries.filter(([key, entry]) => requests.get(key) === entry && entry.state === 'waiting');
    requeue(due);
  }

  function requeue(entries) {
    for (const [, entry] of entries) entry.state = 'queued';
    stack.unshift(...entries.map(([key]) => key).reverse());
    pump();
  }

  // A second chance for the failed requests still listened to (sign-in, foreground, every minute).
  function retryFailed() {
    clearInterval(recoveryTimer);
    recoveryTimer = null;
    const failed = [...requests].filter(([, entry]) => entry.state === 'failed');
    for (const [, entry] of failed) entry.failures = 0;
    requeue(failed);
  }

  function later(run, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, delay);
    timers.add(timer);
  }

  // Requests wait while nobody is signed in and load once someone is.
  function setEnabled(enabled) {
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
    clearInterval(recoveryTimer);
    recoveryTimer = null;
    requests = new Map();
    stack = [];
    activeBatches = 0;
  }

  return { request, setEnabled, retryFailed, dispose };
}
