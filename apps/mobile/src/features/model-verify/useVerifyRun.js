import { useEffect, useSyncExternalStore } from 'react';

import verifyRunStore from './verifyRunStore';

/**
 * The model's latest Verify of `kind` from the server, shared by every screen that shows it
 * (verifyRunStore): `run` undefined while reading, null before the first, and `plan` what the kind's
 * Verify does (undefined while reading); while it runs it is read again every few seconds, as long as
 * a screen shows it. `error` the message when the last read failed: reading goes on, slower each
 * time, and `retry` reads again at once; `show(answer)` puts a run just started in place and follows
 * it.
 */
export default function useVerifyRun(kind, modelId) {
  const runs = verifyRunStore(kind, modelId);
  const state = useSyncExternalStore(runs.subscribe, runs.get);

  useEffect(() => runs.follow(), [runs]);

  return { ...state, retry: runs.retry, show: runs.show };
}
