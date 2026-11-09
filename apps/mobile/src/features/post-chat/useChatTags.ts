import type { AssetRecord } from '@squidbox/shared';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import chatTags from './chatTags';
import taggingState from './taggingState';

import { MIN_REREAD_INTERVAL } from '@/constants';
import tagAttempts from '@/features/photo-tags/tagAttempts';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import type { TagAttempts } from '@/lib/createTagAttempts';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The tags the post chat sees on `assets` (rows), live: a photo's stored tags, or for a photo never
 * tagged (`tags === null`) the chat's own (chatTags): while the assistant is available, each is tagged
 * once by itself in this app run, the tags kept in memory, never stored on the photo.
 * A Tag it or Tag again under way for one of them (tagAttempts) shows and is waited for too.
 * → `rows` (the live assets, in order, with the chat's tags; undefined while reading), `attempts`
 * (the taggings under way, and the chat's that failed, by asset id), `isTagging` (also for a photo about to be
 * tagged by itself), `untagged` (the rows never tagged that nothing will tag without a tap: none
 * while the assistant is available; one whose tags are on their way isn't), `taggingAsync(onWait)`
 * (waits for those under way now, calling `onWait()` first when there are any; resolves to whether
 * there were any) and `retry(id)` (tags one again for the chat: a failed one, or one not tagged). The
 * result changes only when one of these does.
 */
export default function useChatTags(assets: readonly Pick<AssetRecord, 'id'>[]) {
  const isAvailable = useIsAssistantAvailable();
  const deps = useVisionImageDeps();
  const idsKey = assets.map((asset) => asset.id).join('\n');
  const ids = useMemo(() => (idsKey ? idsKey.split('\n') : []), [idsKey]);
  const storedRows = useLiveQuery((db) => readLiveAssets(db, ids), [schema.assets], [ids], {
    minInterval: MIN_REREAD_INTERVAL,
  });
  const chatAttempts = useSyncExternalStore(chatTags.attempts.subscribe, chatTags.attempts.get);
  const storedAttempts = useSyncExternalStore(tagAttempts.subscribe, tagAttempts.get);
  const kept = useSyncExternalStore(chatTags.tags.subscribe, chatTags.tags.get);
  const rows = useMemo(() => storedRows && chatTags.withTags(storedRows, kept), [storedRows, kept]);

  useEffect(() => {
    if (!isAvailable || !rows) return;
    for (const row of rows) {
      // A Tag it under way stores the photo's tags: the chat waits for those instead.
      if (row.tags === null && storedAttempts[row.id]?.status !== 'loading') chatTags.once(row, deps);
    }
  }, [isAvailable, rows, deps, storedAttempts]);

  return useMemo(() => {
    const attempts = Object.fromEntries(
      ids.flatMap((id) => {
        const attempt = runningAttempt(id, chatAttempts, storedAttempts) ?? chatAttempts[id];
        return attempt ? [[id, attempt]] : [];
      }),
    );
    const { isTagging, untagged } = taggingState(rows, attempts, isAvailable, chatTags.attempts.hasRun);

    // Read when called, so a tagging that started since the last render is waited for too.
    async function taggingAsync(onWait?: () => void) {
      const chatNow = chatTags.attempts.get();
      const storedNow = tagAttempts.get();
      const running = ids.flatMap((id) => runningAttempt(id, chatNow, storedNow)?.promise ?? []);
      if (running.length > 0) onWait?.();
      await Promise.allSettled(running);
      return running.length > 0;
    }

    function retry(id: string) {
      const row = rows?.find((each) => each.id === id);
      if (row) chatTags.run(row, deps).catch(() => {});
    }

    return { rows, attempts, isTagging, untagged, taggingAsync, retry };
  }, [ids, rows, chatAttempts, storedAttempts, deps, isAvailable]);
}

// The photo's tagging under way: the chat's own, or one storing its tags (Tag it, Tag again).
function runningAttempt(id: string, chat: TagAttempts, stored: TagAttempts) {
  if (chat[id]?.status === 'loading') return chat[id];
  return stored[id]?.status === 'loading' ? stored[id] : undefined;
}

export type ChatTagging = ReturnType<typeof useChatTags>;
