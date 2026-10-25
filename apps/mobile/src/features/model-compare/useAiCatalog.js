import { useCallback, useEffect, useState } from 'react';

import { fetchAiModelsAsync } from './aiApi';
import apiErrorMessage from './apiErrorMessage';

/**
 * Venice's current models, fetched on mount: `models` is null until they're in, `error` the message
 * when the fetch failed, and `retry` fetches again.
 */
export default function useAiCatalog() {
  const [state, setState] = useState({ models: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setState((current) => (current.error ? { models: null, error: null } : current));
    fetchAiModelsAsync()
      .then((models) => isCurrent && setState({ models, error: null }))
      .catch((error) => isCurrent && setState({ models: null, error: apiErrorMessage(error) }));
    return () => {
      isCurrent = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { ...state, retry };
}
