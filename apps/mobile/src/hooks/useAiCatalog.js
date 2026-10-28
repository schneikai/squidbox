import { useCallback, useEffect, useSyncExternalStore } from 'react';

import createStore from '@/lib/createStore';
import fetchAiModelsAsync from '@/utils/cloud-api/ai/fetchAiModelsAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// As long as the server keeps its own copy of Venice's list.
const CACHE_MS = 5 * 60 * 1000;

// The catalog every screen that shows the models reads: Venice's models with Squidbox's marks, and
// the defaults. `at` is when it came in; a mark an ai_admin sets replaces it at once (applyAiCatalog).
const catalog = createStore({ models: null, defaults: null, error: null, at: 0 });

// One fetch in flight, shared by the screens that open while it runs.
let inFlight = null;

/** Puts a catalog the server answered (`{ models, defaults }`) in front of every screen. */
export function applyAiCatalog({ models, defaults }) {
  catalog.set({ models, defaults, error: null, at: Date.now() });
}

/** Fetches the catalog now, unless a fetch is running; a failure is the store's `error`. */
function refreshAiCatalogAsync() {
  if (inFlight) return inFlight;
  // A catalog applied meanwhile (a mark's answer) is newer than this fetch's: it stays.
  const { at } = catalog.get();
  inFlight = fetchAiModelsAsync()
    .then((response) => {
      if (catalog.get().at === at) applyAiCatalog(response);
    })
    .catch((error) => catalog.set((current) => ({ ...current, error: apiErrorMessage(error) })))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Venice's current models with the marks, and the defaults: `models` and `defaults` are null until
 * they're in, `error` the message when the fetch failed (while there are none to show), and `retry`
 * fetches again. A screen opened after the catalog is five minutes old fetches it anew, showing the
 * old one meanwhile.
 */
export default function useAiCatalog() {
  const { models, defaults, error } = useSyncExternalStore(catalog.subscribe, catalog.get);

  const retry = useCallback(() => {
    if (catalog.get().error) catalog.set((current) => ({ ...current, error: null }));
    refreshAiCatalogAsync();
  }, []);

  // A failed fetch is tried again by the next screen that opens, like Try again.
  useEffect(() => {
    const { at, error: current } = catalog.get();
    if (current || Date.now() - at >= CACHE_MS) retry();
  }, [retry]);

  return { models, defaults, error: models ? null : error, retry };
}
