/**
 * Runs one piece of work at a time for the sync worker.
 *
 * - `request()` starts `task`, or, if something is already running or queued, schedules exactly one
 *   trailing `task` run after it (requests in the meantime coalesce).
 * - `exclusive(work)` waits for whatever is running, then runs `work` with nothing else running.
 *   Requests made meanwhile are honored once it finishes.
 *
 * A failing task or work item never blocks what comes after it.
 */
export function createSingleFlight(task: () => Promise<void>) {
  let tail: Promise<unknown> = Promise.resolve();
  let active = 0;
  let rerun = false;

  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    active++;
    const result = tail.then(work);
    tail = result
      .catch(() => {})
      .then(() => {
        active--;
        if (active === 0 && rerun) {
          rerun = false;
          enqueue(task).catch(() => {});
        }
      });
    return result;
  }

  return {
    request(): void {
      if (active > 0) {
        rerun = true;
        return;
      }
      enqueue(task).catch(() => {});
    },
    exclusive: enqueue,
  };
}
