// How long typing may pause before what was typed is stored.
const SAVE_DELAY_MS = 600;

const keyOf = (value) => JSON.stringify(value);

/**
 * The engine of useSaveAsYouType (the hook wires it to a screen): stores a value as it changes, one
 * save at a time, in order. `change(value)` stores it once changes pause for `delayMs`; `flush()`
 * stores the latest at once. `save(next, stored, { isLeaving })` gets the latest value and what is
 * stored now (compare them to write only what changed) and resolves to what it stored: nothing (or
 * true) for all of `next`, false for none of it, or the stored value when it stored a part. A save
 * that throws stores nothing and goes to `onError`. `flush({ shouldSync: true })` calls `sync()`
 * after it if a save stored anything since the last sync. `end(write)` waits for the saves under
 * way, runs `write` (a Delete, say) and saves nothing after it, unless `write` fails.
 */
export default function createAutoSaver({ value, save, onError, sync, delayMs = SAVE_DELAY_MS }) {
  let latest = value;
  let stored = value;
  let queue = Promise.resolve();
  let timer = null;
  let isEnded = false;
  let isUnsynced = false;

  async function saveLatest(isLeaving) {
    if (isEnded) return;
    const next = latest;
    if (keyOf(next) === keyOf(stored)) return;
    try {
      const result = await save(next, stored, { isLeaving });
      if (result === false) return;
      stored = result === undefined || result === true ? next : result;
      isUnsynced = true;
    } catch (error) {
      onError(error);
    }
  }

  function flush({ isLeaving = false, shouldSync = false } = {}) {
    clearTimeout(timer);
    timer = null;
    queue = queue
      .then(() => saveLatest(isLeaving))
      .then(() => {
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

  function end(write) {
    clearTimeout(timer);
    timer = null;
    isEnded = true;
    const written = queue.then(write);
    queue = written.catch(() => {});
    return written.catch((error) => {
      isEnded = false;
      throw error;
    });
  }

  return { change, flush, end };
}
