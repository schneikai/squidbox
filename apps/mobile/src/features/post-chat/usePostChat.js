import { CHAT_LIMITS } from '@squidbox/shared';
import { useCallback, useMemo, useRef, useState } from 'react';

import postTags from './postTags';
import promptTurn from './promptTurn';
import useChatSession from './useChatSession';
import useMentions from './useMentions';

import useAssetTags from '@/features/photo-tags/useAssetTags';
import useInstructions from '@/hooks/useInstructions';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import countMediaTypes from '@/utils/assets/countMediaTypes';

const MORE_LIKE_THIS = 'More like this';

/**
 * The assistant chat about a post (`sessionId`, chatSessions'), for a screen that shows it: the chat
 * (useChatSession; null once closed), its post's `assets`, their `tagging` (useAssetTags) and the
 * `mentions` (useMentions), and the sends: `send(turn)` waits for the photos being tagged
 * (`isWaiting`), then sends with the post as it is then (the turn cut to CHAT_LIMITS.message); it
 * resolves to whether the turn went. `sendButton(button)`, `moreLikeThis(text)` and `retry()` (the
 * last reply, after it failed) do the same.
 */
export default function usePostChat(sessionId) {
  const chat = useChatSession(sessionId);
  const draft = chat?.getDraft();
  const assets = useMemo(() => draft?.assets ?? [], [draft]);
  const assetIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const tagging = useAssetTags(assets);
  const mentions = useMentions(assetIds);
  const { texts: instructions } = useInstructions();
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
      mentions: (mentions?.handles ?? [])
        .filter((handle) => handle.length <= CHAT_LIMITS.mention)
        .slice(0, CHAT_LIMITS.mentions),
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

  const sendButton = useCallback((button) => send(promptTurn(button)), [send]);

  // The option stays whole: the instruction (an ai_admin's may be long) gives way to it.
  const moreLikeThis = useCallback(
    (text) => {
      if (!instructions) return false;
      const room = Math.max(0, CHAT_LIMITS.message - text.length - 2);
      return send({ label: MORE_LIKE_THIS, content: `${instructions.moreLikeThis.slice(0, room)}\n\n${text}` });
    },
    [send, instructions],
  );

  const retry = useCallback(() => withContext((context) => chat.retry(context)), [chat, withContext]);

  return { chat, assets, tagging, mentions, isWaiting, send, sendButton, moreLikeThis, retry };
}
