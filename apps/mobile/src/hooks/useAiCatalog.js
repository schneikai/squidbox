import { useCallback, useEffect, useSyncExternalStore } from 'react';

import aiCatalogStore from '@/lib/aiCatalogStore';
import applyAiCatalog from '@/lib/applyAiCatalog';
import fetchAiModelsAsync from '@/utils/cloud-api/ai/fetchAiModelsAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// As long as the server keeps its own copy of Venice's list.
const CACHE_MS = 5 * 60 * 1000;

// One fetch in flight, shared by the screens that open while it runs.
let inFlight = null;

/** Fetches the catalog now, unless a fetch is running; a failure is the store's `error`. */
function refreshAiCatalogAsync() {
  if (inFlight) return inFlight;
  // A catalog applied meanwhile (a mark's answer) is newer than this fetch's: it stays.
  const { at } = aiCatalogStore.get();
  inFlight = fetchAiModelsAsync()
    .then((response) => {
      if (aiCatalogStore.get().at === at) applyAiCatalog(response);
    })
    .catch((error) => aiCatalogStore.set((current) => ({ ...current, error: apiErrorMessage(error) })))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Venice's current models with the marks, the model defaults and the app's default instructions
 * (each kind's published text, else the built-in one): `models`, `defaults` and `instructions` are
 * null until they're in, `error` the message when the fetch failed (while there are none to show), and `retry`
 * fetches again. A screen opened after the catalog is five minutes old fetches it anew, showing the
 * old one meanwhile.
 */
export default function useAiCatalog() {
  const { models, defaults, instructions, error } = useSyncExternalStore(aiCatalogStore.subscribe, aiCatalogStore.get);

  const retry = useCallback(() => {
    if (aiCatalogStore.get().error) aiCatalogStore.set((current) => ({ ...current, error: null }));
    refreshAiCatalogAsync();
  }, []);

  // A failed fetch is tried again by the next screen that opens, like Try again.
  useEffect(() => {
    const { at, error: current } = aiCatalogStore.get();
    if (current || Date.now() - at >= CACHE_MS) retry();
  }, [retry]);

  return { models, defaults, instructions, error: models ? null : error, retry };
}
