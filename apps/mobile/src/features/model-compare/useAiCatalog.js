import { useCallback, useEffect, useState } from 'react';

import { fetchAiModelsAsync } from './aiApi';
import apiErrorMessage from './apiErrorMessage';

// As long as the server keeps its own copy of Venice's list.
const CACHE_MS = 5 * 60 * 1000;

// One fetch for every screen that shows the models, as its promise: screens opened while it runs
// share it, and a failed one is dropped so the next screen (or Try again) fetches anew.
let cache = null;

function catalogAsync() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.promise;
  const entry = { at: Date.now(), promise: fetchAiModelsAsync() };
  cache = entry;
  entry.promise.catch(() => {
    if (cache === entry) cache = null;
  });
  return entry.promise;
}

/**
 * Venice's current models: `models` is null until they're in, `error` the message when the fetch
 * failed, and `retry` fetches again.
 */
export default function useAiCatalog() {
  const [state, setState] = useState({ models: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setState((current) => (current.error ? { models: null, error: null } : current));
    catalogAsync()
      .then((models) => isCurrent && setState({ models, error: null }))
      .catch((error) => isCurrent && setState({ models: null, error: apiErrorMessage(error) }));
    return () => {
      isCurrent = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { ...state, retry };
}
