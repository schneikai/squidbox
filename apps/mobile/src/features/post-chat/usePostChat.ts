import { CHAT_LIMITS, type ChatContext } from '@squidbox/shared';
import { useCallback, useMemo, useRef, useState } from 'react';

import chatMentions from './chatMentions';
import type { UserTurn } from './chatSessions';
import postTags from './postTags';
import useChatSession, { type LiveChat } from './useChatSession';
import useMentions from './useMentions';

import useAssetTags from '@/features/photo-tags/useAssetTags';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import countMediaTypes from '@/utils/assets/countMediaTypes';

const MORE_LIKE_THIS = 'More like this';

/**
 * The assistant chat about a post (`sessionId`, chatSessions'), for a screen that shows it: the chat
 * (useChatSession; null once closed), its post's `assets`, their `tagging` (useAssetTags) and the
 * `mentions` (those it sends, useMentions' with the chat's
 * mentionEdits), and the sends: `send(turn)` waits for the photos being tagged
 * (`isWaiting`), then sends with the post as it is then (the turn cut to CHAT_LIMITS.message); it
 * resolves to whether the turn went. `moreLikeThis(text)` and `retry()` (the last reply, after it
 * failed) do the same.
 */
export default function usePostChat(sessionId: string) {
  const chat = useChatSession(sessionId);
  const draft = chat?.getDraft();
  const assets = useMemo(() => draft?.assets ?? [], [draft]);
  const assetIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const tagging = useAssetTags(assets);
  const found = useMentions(assetIds);
  const mentionEdits = chat?.mentionEdits;
  // The handles the chat may mention and sends: chatMentions'.
  const mentions = useMemo(
    () => found && mentionEdits && { handles: chatMentions(found.handles, mentionEdits), fromAlbum: found.fromAlbum },
    [found, mentionEdits],
  );
  const [isWaiting, setIsWaiting] = useState(false);
  // Set at once, so a second send in the same moment (a typed one while Retry waits) is refused.
  const waitingRef = useRef(false);
  const { taggingAsync, rows: taggedRows, isTagging } = tagging;

  // What the chat (`live`) is about as it is now: the editor's latest caption and assets, the post's
  // tags (their tags, read again once a tagging under way landed, with the card's edits: postTags) and
  // the handles found in their albums' posts.
  const readContextAsync = useCallback(
    async (live: LiveChat): Promise<ChatContext> => {
      const hasWaited = await taggingAsync();
      const { text, assets: now } = live.getDraft();
      const ids = now.map((asset) => asset.id);
      const isCurrent = taggedRows?.length === ids.length && ids.every((id, index) => taggedRows[index].id === id);
      const rows = hasWaited || !isCurrent ? await readLiveAssets(getDb(), ids) : taggedRows;
      return {
        kind: live.kind,
        text: text.slice(0, CHAT_LIMITS.text),
        media: countMediaTypes(now),
        tags: postTags(rows, live.tagEdits).slice(0, CHAT_LIMITS.tags),
        mentions: mentions?.handles ?? [],
      };
    },
    [taggingAsync, taggedRows, mentions],
  );

  // Waits for the photos being tagged (`isWaiting` meanwhile), then hands `go` the chat and the
  // context; one at a time, and none while a reply loads. → whether `go` sent.
  const withContext = useCallback(
    async (go: (live: LiveChat, context: ChatContext) => Promise<void> | null) => {
      if (!chat || chat.isSending || waitingRef.current) return false;
      waitingRef.current = true;
      setIsWaiting(isTagging);
      try {
        return Boolean(go(chat, await readContextAsync(chat)));
      } finally {
        waitingRef.current = false;
        setIsWaiting(false);
      }
    },
    [chat, isTagging, readContextAsync],
  );

  const send = useCallback(
    (turn: UserTurn) =>
      withContext((live, context) =>
        live.send({ ...turn, content: turn.content.slice(0, CHAT_LIMITS.message) }, context),
      ),
    [withContext],
  );

  // The server puts the user's More like this instruction before the option.
  const moreLikeThis = useCallback(
    (text: string) => send({ label: MORE_LIKE_THIS, content: text, moreLikeThis: true }),
    [send],
  );

  const retry = useCallback(() => withContext((live, context) => live.retry(context)), [withContext]);

  return { chat, assets, tagging, mentions, isWaiting, send, moreLikeThis, retry };
}

export type PostChatState = ReturnType<typeof usePostChat>;
