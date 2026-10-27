import { useEffect, useSyncExternalStore } from 'react';

import tagAssetAsync, { tagAssetOnce } from './tagAssetAsync';
import { getTagAttempts, subscribeTagAttempts } from './tagAttempts';

import { MIN_REREAD_INTERVAL } from '@/constants';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The tags of `assets` (rows), live, and their tagging: while the assistant is available, each photo
 * never tagged (`tags === null`) is tagged once by itself in this app run (tagAttempts), and a
 * tagging started anywhere else (Tag again) shows too.
 * → `rows` (the live assets, in order; undefined while reading), `attempts` (the taggings under way
 * or failed, by asset id), `isTagging`, `taggingAsync()` (waits for those under way now; resolves to
 * whether there were any) and `retry(id)` (tags one again: a failed one, or one not tagged).
 */
export default function useAssetTags(assets) {
  const isAvailable = useIsAssistantAvailable();
  const deps = useVisionImageDeps();
  const ids = assets.map((asset) => asset.id);
  const rows = useLiveQuery((db) => readLiveAssets(db, ids), [schema.assets], [ids], {
    minInterval: MIN_REREAD_INTERVAL,
  });
  const allAttempts = useSyncExternalStore(subscribeTagAttempts, getTagAttempts);

  useEffect(() => {
    if (!isAvailable || !rows) return;
    for (const row of rows) if (row.tags === null) tagAssetOnce(row, deps);
  }, [isAvailable, rows, deps]);

  const attempts = Object.fromEntries(ids.flatMap((id) => (allAttempts[id] ? [[id, allAttempts[id]]] : [])));
  const isTagging = Object.values(attempts).some((attempt) => attempt.status === 'loading');

  // Read when called, so a tagging that started since the last render is waited for too.
  async function taggingAsync() {
    const now = getTagAttempts();
    const running = ids.flatMap((id) => (now[id]?.status === 'loading' ? [now[id].promise] : []));
    await Promise.allSettled(running);
    return running.length > 0;
  }

  function retry(id) {
    const row = rows?.find((each) => each.id === id);
    if (row) tagAssetAsync(row, deps).catch(() => {});
  }

  return { rows, attempts, isTagging, taggingAsync, retry };
}
