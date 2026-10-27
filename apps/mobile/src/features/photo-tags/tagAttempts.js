import createStore from '@/lib/createStore';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The taggings under way and the ones that failed in this app run, by asset id: `{ status: 'loading'
// | 'error', error, promise }`; a tagging that landed leaves (its tags are on the row). Every tagging
// goes through here (tagAssetAsync), so a screen shows one started anywhere.
const attempts = createStore({});
// The photos tagged by themselves in this app run: once each, and one whose tagging failed waits for
// a retry, however often the screen that shows it opens again.
const started = new Set();

function setAttempt(id, attempt) {
  attempts.set((current) => {
    const { [id]: _dropped, ...rest } = current;
    return attempt ? { ...rest, [id]: attempt } : rest;
  });
}

/**
 * Runs `tag()` (a promise) for the photo, or joins the one under way; the result is `tag()`'s, a
 * failure staying in the attempts until the next run.
 */
export function runTagging(id, tag) {
  const running = attempts.get()[id];
  if (running?.status === 'loading') return running.promise;
  const promise = new Promise((resolve) => resolve(tag())).then(
    (result) => {
      setAttempt(id, null);
      return result;
    },
    (error) => {
      setAttempt(id, { status: 'error', error: apiErrorMessage(error), promise });
      throw error;
    },
  );
  setAttempt(id, { status: 'loading', error: null, promise });
  return promise;
}

/** Runs `tag()` for the photo unless it was started by itself before in this app run. */
export function tagOnce(id, tag) {
  if (started.has(id)) return;
  started.add(id);
  runTagging(id, tag).catch(() => {});
}

/** Every attempt by asset id, a new object on each change (for useSyncExternalStore). */
export const getTagAttempts = attempts.get;

export const subscribeTagAttempts = attempts.subscribe;
