import SessionChangedError from '@/utils/cloud-api/SessionChangedError';
import UpdateRequiredError from '@/utils/cloud-api/UpdateRequiredError';

// The gate the sync and backup runs start through: a run registers synchronously with its abort
// signal, none starts while a pause holds, and a pause aborts every registered run. A session that
// changed under a run (SessionChangedError), or the server's refusal of this build as too old
// (UpdateRequiredError, which the app shows from its own store), ends it like an abort, not as a
// failure.
interface Run {
  controller: AbortController;
  done: Promise<void>;
}

let pauses = 0;
const runs = new Set<Run>();

/** Starts `work` unless paused (null then); resolves when it ends, aborted or not. */
export function startRun(work: (signal: AbortSignal) => Promise<void>): Promise<void> | null {
  if (pauses > 0) return null;
  const controller = new AbortController();
  const result = work(controller.signal).catch((error) => {
    if (!endsRun(error)) throw error;
  });
  const run: Run = { controller, done: result.catch(() => {}) };
  runs.add(run);
  run.done.then(() => runs.delete(run));
  return result;
}

/** Aborts every registered run and holds new ones until `resume`; `stopped` resolves once they ended. */
export function pauseRuns(): { stopped: Promise<void>; resume(): void } {
  pauses += 1;
  for (const run of runs) run.controller.abort();
  return {
    stopped: Promise.all([...runs].map((run) => run.done)).then(() => {}),
    resume() {
      pauses -= 1;
    },
  };
}

/** Whether `error` ends a run like an abort instead of failing it (see above). */
export function endsRun(error: unknown): boolean {
  return error instanceof SessionChangedError || error instanceof UpdateRequiredError;
}
