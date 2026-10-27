import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The photos the assistant started tagging by itself in this app run, by asset id: `{ status:
// 'loading' | 'done' | 'error', error, promise }`. A photo is tagged by itself once per run, and one
// whose tagging failed waits for a retry, however often the screen that shows it opens again.
let attempts = {};
const listeners = new Set();

function set(id, attempt) {
  attempts = { ...attempts, [id]: attempt };
  for (const listener of listeners) listener();
}

function run(id, tag) {
  const promise = new Promise((resolve) => resolve(tag())).then(
    () => set(id, { status: 'done', error: null, promise }),
    (error) => set(id, { status: 'error', error: apiErrorMessage(error), promise }),
  );
  set(id, { status: 'loading', error: null, promise });
  return promise;
}

/** Starts `tag()` (a promise) for the photo unless it was started before in this app run. */
export function tagOnce(id, tag) {
  if (attempts[id]) return attempts[id].promise;
  return run(id, tag);
}

/** Starts `tag()` for the photo again, unless a tagging of it is under way. */
export function retryTagging(id, tag) {
  if (attempts[id]?.status === 'loading') return attempts[id].promise;
  return run(id, tag);
}

/** Every attempt by asset id, a new object on each change (for useSyncExternalStore). */
export function getTagAttempts() {
  return attempts;
}

export function subscribeTagAttempts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
