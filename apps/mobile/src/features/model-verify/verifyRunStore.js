import createStore from '@/lib/createStore';
import fetchVerifyRunAsync from '@/utils/cloud-api/ai/fetchVerifyRunAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// How often a running Verify is read again: each turn takes a few seconds. After a failed read the
// next waits twice as long each time, up to MAX_BACKOFF_MS.
const POLL_MS = 3000;
const MAX_BACKOFF_MS = 30_000;

// When to read the run next: at once without one, after POLL_MS while it runs, else never.
const nextDelay = (run) => (run === undefined ? 0 : run?.status === 'running' ? POLL_MS : null);

// `next` as the screens show it, keeping what didn't change: the same run while no turn came in, and
// the turns it already had (they're only ever appended), so their rows don't render again.
function merged(current, next) {
  if (!current || !next || current.id !== next.id) return next;
  if (current.status === next.status && current.turnsDone === next.turnsDone) return current;
  const sectionsBefore = new Map(current.result?.sections.map((section) => [section.id, section]));
  const sections = next.result?.sections.map((section) => {
    const before = sectionsBefore.get(section.id);
    if (!before) return section;
    return { ...section, turns: [...before.turns, ...section.turns.slice(before.turns.length)] };
  });
  return next.result ? { ...next, result: { ...next.result, sections } } : next;
}

// One model's latest Verify of a kind, read while a screen follows it.
function createVerifyRun(kind, modelId) {
  const store = createStore({ run: undefined, plan: undefined, error: null });
  let followers = 0;
  let timer = null;
  let isReading = false;
  let failures = 0;
  // Bumped by `show`: a read that started before it answers an older run, and is dropped.
  let version = 0;

  function schedule(delay) {
    clearTimeout(timer);
    timer = null;
    if (delay === null || followers === 0 || isReading) return;
    timer = setTimeout(read, delay);
  }

  async function read() {
    timer = null;
    isReading = true;
    const startedAt = version;
    let delay;
    try {
      const { run, plan } = await fetchVerifyRunAsync(kind, modelId);
      if (startedAt === version) {
        failures = 0;
        store.set((current) => {
          const shown = merged(current.run, run);
          const isSame = shown === current.run && current.plan !== undefined && current.error === null;
          return isSame ? current : { run: shown, plan: current.plan ?? plan, error: null };
        });
      }
      delay = nextDelay(store.get().run);
    } catch (error) {
      failures += 1;
      if (startedAt === version) store.set((current) => ({ ...current, error: apiErrorMessage(error) }));
      delay = Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS);
    }
    isReading = false;
    schedule(delay);
  }

  return {
    get: store.get,
    subscribe: store.subscribe,
    /** Reads the run while the caller follows it (as needed: at once, then while it runs); answers the stop. */
    follow() {
      followers += 1;
      if (followers === 1) schedule(nextDelay(store.get().run));
      return () => {
        followers -= 1;
        if (followers === 0) schedule(null);
      };
    },
    retry() {
      if (store.get().error) store.set((current) => ({ ...current, error: null }));
      schedule(0);
    },
    show({ run, plan }) {
      version += 1;
      store.set({ run, plan, error: null });
      schedule(nextDelay(run));
    },
  };
}

const runs = new Map();

/**
 * The model's latest Verify of `kind`, one per model and kind for the app's run, so the model page,
 * the Verify page and a conversation page read and follow the same run: `get()` (`{ run, plan,
 * error }`), `subscribe(listener)`, `follow()`, `retry()` and `show({ run, plan })`.
 */
export default function verifyRunStore(kind, modelId) {
  const key = `${kind}:${modelId}`;
  if (!runs.has(key)) runs.set(key, createVerifyRun(kind, modelId));
  return runs.get(key);
}
