import { CHAT_LIMITS } from '@squidbox/shared';
import { useCallback, useMemo, useRef, useState } from 'react';

import chatMentions from './chatMentions';
import postTags from './postTags';
import useChatSession from './useChatSession';
import useMentions from './useMentions';

import useAssetTags from '@/features/photo-tags/useAssetTags';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import countMediaTypes from '@/utils/assets/countMediaTypes';
import tagKey from '@/utils/tagKey';

const MORE_LIKE_THIS = 'More like this';

/**
 * The assistant chat about a post (`sessionId`, chatSessions'), for a screen that shows it: the chat
 * (useChatSession; null once closed), its post's `assets`, their `tagging` (useAssetTags) and the
 * `mentions` (`{ handles, more, fromAlbum }`: those it sends, useMentions' with the chat's
 * mentionEdits, and the posts' others), and the sends: `send(turn)` waits for the photos being tagged
 * (`isWaiting`), then sends with the post as it is then (the turn cut to CHAT_LIMITS.message); it
 * resolves to whether the turn went. `moreLikeThis(text)` and `retry()` (the last reply, after it
 * failed) do the same.
 */
export default function usePostChat(sessionId) {
  const chat = useChatSession(sessionId);
  const draft = chat?.getDraft();
  const assets = useMemo(() => draft?.assets ?? [], [draft]);
  const assetIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const tagging = useAssetTags(assets);
  const found = useMentions(assetIds);
  const mentionEdits = chat?.mentionEdits;
  // The handles the chat may mention (the posts', with the Mentions sheet's edits: chatMentions), the
  // ones it sends, and the posts' others to add back.
  const mentions = useMemo(() => {
    if (!found || !mentionEdits) return undefined;
    const handles = chatMentions(found.handles, mentionEdits)
      .filter((handle) => handle.length <= CHAT_LIMITS.mention)
      .slice(0, CHAT_LIMITS.mentions);
    const chosen = new Set(handles.map(tagKey));
    const more = found.handles.filter((handle) => !chosen.has(tagKey(handle)));
    return { handles, more, fromAlbum: found.fromAlbum };
  }, [found, mentionEdits]);
  const [isWaiting, setIsWaiting] = useState(false);
  // Set at once, so a second send in the same moment (a typed one while Retry waits) is refused.
  const waitingRef = useRef(false);
  const { taggingAsync, rows: taggedRows, isTagging } = tagging;

  // What the chat is about as it is now: the editor's latest caption and assets, the post's tags
  // (their tags, read again once a tagging under way landed, with the card's edits: postTags) and the
  // handles found in their albums' posts.
  const readContextAsync = useCallback(async () => {
    const hasWaited = await taggingAsync();
    const { text, assets: now } = chat.getDraft();
    const ids = now.map((asset) => asset.id);
    const isCurrent = taggedRows?.length === ids.length && ids.every((id, index) => taggedRows[index].id === id);
    const rows = hasWaited || !isCurrent ? await readLiveAssets(getDb(), ids) : taggedRows;
    return {
      kind: chat.kind,
      text: text.slice(0, CHAT_LIMITS.text),
      media: countMediaTypes(now),
      tags: postTags(rows, chat.tagEdits).slice(0, CHAT_LIMITS.tags),
      mentions: mentions?.handles ?? [],
    };
  }, [chat, taggingAsync, taggedRows, mentions]);

  // Waits for the photos being tagged (`isWaiting` meanwhile), then hands `go` the context; one at a
  // time, and none while a reply loads. → whether `go` sent.
  const withContext = useCallback(
    async (go) => {
      if (!chat || chat.isSending || waitingRef.current) return false;
      waitingRef.current = true;
      setIsWaiting(isTagging);
      try {
        return Boolean(go(await readContextAsync()));
      } finally {
        waitingRef.current = false;
        setIsWaiting(false);
      }
    },
    [chat, isTagging, readContextAsync],
  );

  const send = useCallback(
    (turn) =>
      withContext((context) => chat.send({ ...turn, content: turn.content.slice(0, CHAT_LIMITS.message) }, context)),
    [chat, withContext],
  );

  // The server puts the user's More like this instruction before the option.
  const moreLikeThis = useCallback(
    (text) => send({ label: MORE_LIKE_THIS, content: text, moreLikeThis: true }),
    [send],
  );

  const retry = useCallback(() => withContext((context) => chat.retry(context)), [chat, withContext]);

  return { chat, assets, tagging, mentions, isWaiting, send, moreLikeThis, retry };
}
