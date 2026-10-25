import { useCallback, useEffect, useState } from 'react';

import { fetchAiModelsAsync } from '@/utils/cloud-api/aiApi';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// As long as the server keeps its own copy of Venice's list.
const CACHE_MS = 5 * 60 * 1000;

// One fetch for every screen that shows the models, as its promise: screens opened while it runs
// share it, and a failed one is dropped so the next screen (or Try again) fetches anew.
let cache = null;

function isFresh() {
  return !!cache && Date.now() - cache.at < CACHE_MS;
}

function catalogAsync() {
  if (isFresh()) return cache.promise;
  const entry = { at: Date.now(), promise: fetchAiModelsAsync(), models: null };
  cache = entry;
  entry.promise.then(
    (models) => {
      entry.models = models;
    },
    () => {
      if (cache === entry) cache = null;
    },
  );
  return entry.promise;
}

// The models already in, so a screen opened after the fetch draws them in its first render.
function cachedModels() {
  return isFresh() ? cache.models : null;
}

/**
 * Venice's current models: `models` is null until they're in, `error` the message when the fetch
 * failed, and `retry` fetches again.
 */
export default function useAiCatalog() {
  const [state, setState] = useState(() => ({ models: cachedModels(), error: null }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setState((current) => (current.error ? { models: null, error: null } : current));
    catalogAsync()
      .then(
        (models) => isCurrent && setState((current) => (current.models === models ? current : { models, error: null })),
      )
      .catch((error) => isCurrent && setState({ models: null, error: apiErrorMessage(error) }));
    return () => {
      isCurrent = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { ...state, retry };
}
