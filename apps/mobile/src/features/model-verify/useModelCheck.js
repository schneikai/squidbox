import { useCallback, useEffect, useState } from 'react';

import fetchModelCheckAsync from '@/utils/cloud-api/ai/fetchModelCheckAsync';
import startModelCheckAsync from '@/utils/cloud-api/ai/startModelCheckAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// How often a running check is read again: each turn takes a few seconds.
const POLL_MS = 3000;

/**
 * The model's latest check of `kind` from the server: `check` undefined while reading, null before
 * the first; while it runs it is read again every few seconds. `error` the message when a read
 * failed, `retry` reads again; `start` runs a new check (rejects with the server's reason).
 */
export default function useModelCheck(kind, modelId) {
  const [state, setState] = useState({ check: undefined, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    let timer = null;
    async function readAsync() {
      try {
        const check = await fetchModelCheckAsync(kind, modelId);
        if (!isCurrent) return;
        setState({ check, error: null });
        if (check?.status === 'running') timer = setTimeout(readAsync, POLL_MS);
      } catch (error) {
        if (isCurrent) setState((current) => ({ ...current, error: apiErrorMessage(error) }));
      }
    }
    readAsync();
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [kind, modelId, attempt]);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
    setAttempt((count) => count + 1);
  }, []);

  const start = useCallback(async () => {
    const check = await startModelCheckAsync(kind, modelId);
    setState({ check, error: null });
    setAttempt((count) => count + 1);
  }, [kind, modelId]);

  return { ...state, retry, start };
}
