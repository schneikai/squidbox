import createStore from '@/lib/createStore';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// A tagging under way or failed; it resolves to the photo's tags.
export type TagAttempt = { status: 'loading' | 'error'; error: string | null; promise: Promise<string[]> };

// By asset id; none for a photo with no attempt.
export type TagAttempts = Partial<Record<string, TagAttempt>>;

/**
 * A set of the photos' taggings: `run(id, tag)`, `once(id, tag)`, `get()` (every attempt by asset id,
 * a new object on each change, for useSyncExternalStore), `subscribe(listener)` and `hasRun(id)`
 * (tagged in this app run, by any caller). Taggings that store tags on the photo go through
 * tagAttempts, the post chat's own through chatTags.
 */
export default function createTagAttempts() {
  // The taggings under way and the ones that failed in this app run, by asset id; a tagging that
  // landed leaves (its tags are where its caller keeps them).
  const attempts = createStore<TagAttempts>({});
  // The photos tagged in this app run, whatever came of it: a photo is tagged by itself once, one
  // whose tagging failed waits for a retry, and one that was tagged isn't "not tagged" while its tags
  // catch up.
  const ran = new Set<string>();

  function setAttempt(id: string, attempt: TagAttempt | null) {
    attempts.set((current) => {
      const { [id]: _dropped, ...rest } = current;
      return attempt ? { ...rest, [id]: attempt } : rest;
    });
  }

  /**
   * Runs `tag()` (a promise) for the photo, or joins the one under way; the result is `tag()`'s, a
   * failure staying in the attempts until the next run.
   */
  function run(id: string, tag: () => Promise<string[]>): Promise<string[]> {
    const running = attempts.get()[id];
    if (running?.status === 'loading') return running.promise;
    ran.add(id);
    const promise = new Promise<string[]>((resolve) => resolve(tag())).then(
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

  /** Runs `tag()` for the photo unless it was tagged before in this app run. */
  function once(id: string, tag: () => Promise<string[]>): void {
    if (ran.has(id)) return;
    run(id, tag).catch(() => {});
  }

  return {
    run,
    once,
    get: attempts.get,
    subscribe: attempts.subscribe,
    hasRun: (id: string) => ran.has(id),
  };
}
