import { useEffect, useMemo, useSyncExternalStore } from 'react';

import tagAssetAsync from './tagAssetAsync';
import tagAssetOnce from './tagAssetOnce';
import tagAttempts from './tagAttempts';

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
 * or failed, by asset id), `isTagging` (also for a photo about to be tagged by itself), `untagged`
 * (the rows never tagged that nothing will tag without a tap: none while the assistant is available;
 * one whose tags are still on their way isn't), `taggingAsync()` (waits for those under way
 * now; resolves to whether there were any) and `retry(id)` (tags one again: a failed one, or one not
 * tagged). The result changes only when one of these does.
 */
export default function useAssetTags(assets) {
  const isAvailable = useIsAssistantAvailable();
  const deps = useVisionImageDeps();
  const idsKey = assets.map((asset) => asset.id).join('\n');
  const ids = useMemo(() => (idsKey ? idsKey.split('\n') : []), [idsKey]);
  const rows = useLiveQuery((db) => readLiveAssets(db, ids), [schema.assets], [ids], {
    minInterval: MIN_REREAD_INTERVAL,
  });
  const allAttempts = useSyncExternalStore(tagAttempts.subscribe, tagAttempts.get);

  useEffect(() => {
    if (!isAvailable || !rows) return;
    for (const row of rows) if (row.tags === null) tagAssetOnce(row, deps);
  }, [isAvailable, rows, deps]);

  return useMemo(() => {
    const attempts = Object.fromEntries(ids.flatMap((id) => (allAttempts[id] ? [[id, allAttempts[id]]] : [])));
    // Never tagged and not tried in this app run: the effect above tags it right after this render
    // while the assistant is available (so it counts as tagging already), else it waits for Tag. A
    // photo tried before has an attempt, or its tags are on their way to the row.
    const notTried = (rows ?? []).filter(
      (row) => row.tags === null && !attempts[row.id] && !tagAttempts.hasRun(row.id),
    );
    const isTagging =
      Object.values(attempts).some((attempt) => attempt.status === 'loading') || (isAvailable && notTried.length > 0);
    const untagged = isAvailable ? [] : notTried;

    // Read when called, so a tagging that started since the last render is waited for too.
    async function taggingAsync() {
      const now = tagAttempts.get();
      const running = ids.flatMap((id) => (now[id]?.status === 'loading' ? [now[id].promise] : []));
      await Promise.allSettled(running);
      return running.length > 0;
    }

    function retry(id) {
      const row = rows?.find((each) => each.id === id);
      if (row) tagAssetAsync(row, deps).catch(() => {});
    }

    return { rows, attempts, isTagging, untagged, taggingAsync, retry };
  }, [ids, rows, allAttempts, deps, isAvailable]);
}
