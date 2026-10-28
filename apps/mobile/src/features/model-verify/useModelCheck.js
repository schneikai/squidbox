import { useCallback, useEffect, useRef, useState } from 'react';

import fetchModelCheckAsync from '@/utils/cloud-api/ai/fetchModelCheckAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// How often a running check is read again: each turn takes a few seconds. After a failed read the
// next waits twice as long each time, up to MAX_BACKOFF_MS.
const POLL_MS = 3000;
const MAX_BACKOFF_MS = 30_000;

// When to read the check next: at once without one, after POLL_MS while it runs, else never.
const nextRead = (check) => ({ delay: check === undefined ? 0 : check?.status === 'running' ? POLL_MS : null });

// `next` as the screen shows it, keeping what didn't change: the same check while no turn came in,
// and the turns it already had (they're only ever appended), so their cards don't render again.
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
 * The model's latest check of `kind` from the server: `check` undefined while reading, null before
 * the first; while it runs it is read again every few seconds. `initialCheck` is one the caller has
 * already (the start's answer), so it isn't read again at once. `error` the message when the last
 * read failed: reading goes on, slower each time, and `retry` reads again at once; `show(check)` puts
 * a check just started in place and follows it.
 */
export default function useModelCheck(kind, modelId, initialCheck) {
  const [state, setState] = useState({ check: initialCheck, error: null });
  const [read, setRead] = useState(() => nextRead(initialCheck));
  const failures = useRef(0);

  useEffect(() => {
    if (read.delay === null) return undefined;
    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        const check = await fetchModelCheckAsync(kind, modelId);
        if (!isCurrent) return;
        failures.current = 0;
        setState((current) => {
          const shown = merged(current.check, check);
          return shown === current.check && current.error === null ? current : { check: shown, error: null };
        });
        setRead(nextRead(check));
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

  const show = useCallback((check) => {
    setState({ check, error: null });
    setRead(nextRead(check));
  }, []);

  return { ...state, retry, show };
}
