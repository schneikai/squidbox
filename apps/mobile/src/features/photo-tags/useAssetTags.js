import { useEffect, useSyncExternalStore } from 'react';

import tagAssetAsync from './tagAssetAsync';
import { getTagAttempts, retryTagging, subscribeTagAttempts, tagOnce } from './tagAttempts';

import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The tags of `assets` (rows), live, and their tagging: while the assistant is available, each photo
 * never tagged (`tags === null`) is tagged once by itself in this app run (tagAttempts).
 * → `rows` (the live assets, in order; undefined while reading), `attempts` (by asset id, see
 * tagAttempts), `isTagging` (any of them under way), `taggingAsync()` (settles once those under way
 * did) and `retry(id)` (tags one again: a failed one, or one not tagged).
 */
export default function useAssetTags(assets) {
  const isAvailable = useIsAssistantAvailable();
  const deps = useVisionImageDeps();
  const ids = assets.map((asset) => asset.id);
  const rows = useLiveQuery((db) => readLiveAssets(db, ids), [schema.assets], [ids]);
  const allAttempts = useSyncExternalStore(subscribeTagAttempts, getTagAttempts);

  useEffect(() => {
    if (!isAvailable || !rows) return;
    for (const row of rows) {
      if (row.tags === null) tagOnce(row.id, () => tagAssetAsync(row, deps));
    }
  }, [isAvailable, rows, deps]);

  const attempts = Object.fromEntries(ids.flatMap((id) => (allAttempts[id] ? [[id, allAttempts[id]]] : [])));
  const isTagging = Object.values(attempts).some((attempt) => attempt.status === 'loading');

  // Read when called, so a tagging that started since the last render is waited for too.
  function taggingAsync() {
    const now = getTagAttempts();
    return Promise.all(ids.flatMap((id) => (now[id]?.status === 'loading' ? [now[id].promise] : [])));
  }

  function retry(id) {
    const row = rows?.find((each) => each.id === id);
    if (row) retryTagging(id, () => tagAssetAsync(row, deps));
  }

  return { rows, attempts, isTagging, taggingAsync, retry };
}
