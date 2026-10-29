import { useCallback, useEffect, useRef, useState } from 'react';

import fetchVerifyRunAsync from '@/utils/cloud-api/ai/fetchVerifyRunAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// How often a running Verify is read again: each turn takes a few seconds. After a failed read the
// next waits twice as long each time, up to MAX_BACKOFF_MS.
const POLL_MS = 3000;
const MAX_BACKOFF_MS = 30_000;

// When to read the run next: at once without one, after POLL_MS while it runs, else never.
const nextRead = (run) => ({ delay: run === undefined ? 0 : run?.status === 'running' ? POLL_MS : null });

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

/**
 * The model's latest Verify of `kind` from the server: `run` undefined while reading, null before the
 * first, and `plan` what the kind's Verify does (undefined while reading); while it runs it is read
 * again every few seconds. `initial` is a `{ run, plan }` answer the caller has already (the start's),
 * so it isn't read again at once. `error` the message when the last read failed: reading goes on,
 * slower each time, and `retry` reads again at once; `show(answer)` puts a run just started in place
 * and follows it.
 */
export default function useVerifyRun(kind, modelId, initial) {
  const [state, setState] = useState({ run: initial?.run, plan: initial?.plan, error: null });
  const [read, setRead] = useState(() => nextRead(initial?.run));
  const failures = useRef(0);

  useEffect(() => {
    if (read.delay === null) return undefined;
    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        const { run, plan } = await fetchVerifyRunAsync(kind, modelId);
        if (!isCurrent) return;
        failures.current = 0;
        setState((current) => {
          const shown = merged(current.run, run);
          const isSame = shown === current.run && current.plan !== undefined && current.error === null;
          return isSame ? current : { run: shown, plan: current.plan ?? plan, error: null };
        });
        setRead(nextRead(run));
      } catch (error) {
        if (!isCurrent) return;
        failures.current += 1;
        setState((current) => ({ ...current, error: apiErrorMessage(error) }));
        setRead({ delay: Math.min(POLL_MS * 2 ** failures.current, MAX_BACKOFF_MS) });
      }
    }, read.delay);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [kind, modelId, read]);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
    setRead({ delay: 0 });
  }, []);

  const show = useCallback(({ run, plan }) => {
    setState({ run, plan, error: null });
    setRead(nextRead(run));
  }, []);

  return { ...state, retry, show };
}
