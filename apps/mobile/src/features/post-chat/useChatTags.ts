import type { AssetRecord } from '@squidbox/shared';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import chatTags from './chatTags';
import taggingState from './taggingState';

import { MIN_REREAD_INTERVAL } from '@/constants';
import tagAttempts from '@/features/photo-tags/tagAttempts';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

type ChatTagsOptions = {
  // Tags the photos never tagged as soon as they show (the chat screen), not only when a turn goes.
  tagsOnOpen?: boolean;
};

/**
 * The tags the post chat sees on `assets` (rows), live: a photo's stored tags, or for a photo never
 * tagged (`tags === null`) the chat's own (chatTags): while the assistant is available, each is tagged
 * once in this app run, when a turn goes (chatTags.tagMissingAsync) or, with `tagsOnOpen`, as soon
 * as it shows (by the same rule), the tags kept in memory, never stored on the photo. A Tag it or Tag again under way for one
 * of them (tagAttempts) shows and is waited for too. → `rows` (the live assets, in order, with the
 * chat's tags; undefined while reading), `attempts` (the taggings under way, and the chat's that
 * failed, by asset id), `isTagging` (taggingState: with `tagsOnOpen`, also for a photo about to be
 * tagged), `untagged` (the rows never tagged that nothing will tag without a tap: none while the
 * assistant is available) and `retry(id)` (tags one again for the chat: a failed one, or one not tagged).
 * The result changes only when one of these does.
 */
export default function useChatTags(
  assets: readonly Pick<AssetRecord, 'id'>[],
  { tagsOnOpen = false }: ChatTagsOptions = {},
) {
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

  // The photos never tagged nor tried in this app run: the chat screen tags them as they show, by the
  // rule a turn tags them by. Keyed on their ids, so only a new one starts a read, not each tag landing.
  const notTriedKey = (rows ?? [])
    .filter((row) => row.tags === null && !chatTags.attempts.hasRun(row.id))
    .map((row) => row.id)
    .join('\n');
  useEffect(() => {
    if (tagsOnOpen && isAvailable && notTriedKey) {
      chatTags.tagMissingAsync(notTriedKey.split('\n'), { deps, isAvailable }).catch(() => {});
    }
  }, [tagsOnOpen, isAvailable, notTriedKey, deps]);

  return useMemo(() => {
    const attempts = Object.fromEntries(
      ids.flatMap((id) => {
        const attempt = chatTags.runningAttempt(id, chatAttempts, storedAttempts) ?? chatAttempts[id];
        return attempt ? [[id, attempt]] : [];
      }),
    );
    const { isTagging, untagged } = taggingState(rows, attempts, {
      isAvailable,
      willTag: tagsOnOpen,
      hasRun: chatTags.attempts.hasRun,
    });

    function retry(id: string) {
      const row = rows?.find((each) => each.id === id);
      if (row) chatTags.run(row, deps).catch(() => {});
    }

    return { rows, attempts, isTagging, untagged, retry };
  }, [ids, rows, chatAttempts, storedAttempts, deps, isAvailable, tagsOnOpen]);
}

export type ChatTagging = ReturnType<typeof useChatTags>;
