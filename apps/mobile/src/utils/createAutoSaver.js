// How long typing may pause before what was typed is stored.
const SAVE_DELAY_MS = 600;

const keyOf = (value) => JSON.stringify(value);

/**
 * The engine of useSaveAsYouType (the hook wires it to a screen): stores a value as it changes, one
 * save at a time, in order. `change(value)` stores it once changes pause for `delayMs`; `flush()`
 * stores the latest at once. `save(next, stored)` gets the latest value and what is stored now
 * (compare them to write only what changed) and stores all of `next`. A save that throws stores
 * nothing and goes to `onError`. `flush({ shouldSync: true })` calls `sync()` after it if a
 * save stored anything since the last sync.
 */
export default function createAutoSaver({ value, save, onError, sync, delayMs = SAVE_DELAY_MS }) {
  let latest = value;
  let stored = value;
  let queue = Promise.resolve();
  let timer = null;
  let isUnsynced = false;

  async function saveLatest() {
    const next = latest;
    if (keyOf(next) === keyOf(stored)) return;
    try {
      await save(next, stored);
      stored = next;
      isUnsynced = true;
    } catch (error) {
      onError(error);
    }
  }

  function flush({ shouldSync = false } = {}) {
    clearTimeout(timer);
    timer = null;
    queue = queue.then(saveLatest).then(() => {
      if (!shouldSync || !isUnsynced) return;
      isUnsynced = false;
      sync();
    });
    return queue;
  }

  function change(next) {
    if (keyOf(next) === keyOf(latest)) return;
    latest = next;
    clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  }

  return { change, flush };
}
