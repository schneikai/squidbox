import { CHAT_LIMITS, type ChatContext } from '@squidbox/shared';
import { useCallback, useMemo, useState } from 'react';

import chatMentions from './chatMentions';
import chatSessions, { type ChatSession, type UserTurn } from './chatSessions';
import postTags from './postTags';
import useChatSession from './useChatSession';
import useMentions from './useMentions';

import useAssetTags from '@/features/photo-tags/useAssetTags';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import countMediaTypes from '@/utils/assets/countMediaTypes';
import chatAsync from '@/utils/cloud-api/ai/chatAsync';

const MORE_LIKE_THIS = 'More like this';

/**
 * The assistant chat about a post (`sessionId`, chatSessions'), for a screen that shows it: the chat
 * (useChatSession; null once closed), its post's `assets`, their `tagging` (useAssetTags) and the
 * `mentions` (those it sends, useMentions' with the chat's
 * mentionEdits), and the sends: `send(turn)` puts the turn (cut to CHAT_LIMITS.message) in the chat at
 * once and returns whether it went (false: a reply loads, or the chat is closed); the context is read
 * then, with the post as it is then, waiting for the photos being tagged (`isWaiting` meanwhile).
 * `moreLikeThis(text)` and `retry()` (the last reply, after it failed) do the same.
 */
export default function usePostChat(sessionId: string) {
  const chat = useChatSession(sessionId);
  // The chat itself, the same object all chat long, unlike `chat`: the sends built on it keep their
  // identity, so memo(AssistantMessage) and memo(ChatOptionCard) do their job.
  const session = chatSessions.get(sessionId);
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
  const { taggingAsync, rows: taggedRows, isTagging } = tagging;

  // What the chat (`live`) is about as it is now: the editor's latest caption and assets, the post's
  // tags (their tags, read again once a tagging under way landed, with the card's edits: postTags) and
  // the handles found in their albums' posts. Waits for the photos being tagged (`isWaiting`
  // meanwhile).
  const readContextAsync = useCallback(
    async (live: ChatSession): Promise<ChatContext> => {
      setIsWaiting(isTagging);
      try {
        const hasWaited = await taggingAsync();
        const { text, assets: now } = live.getDraft();
        const { kind, tagEdits } = live.getState();
        const ids = now.map((asset) => asset.id);
        const isCurrent = taggedRows?.length === ids.length && ids.every((id, index) => taggedRows[index].id === id);
        const rows = hasWaited || !isCurrent ? await readLiveAssets(getDb(), ids) : taggedRows;
        return {
          kind,
          text: text.slice(0, CHAT_LIMITS.text),
          media: countMediaTypes(now),
          tags: postTags(rows, tagEdits).slice(0, CHAT_LIMITS.tags),
          mentions: mentions?.handles ?? [],
        };
      } finally {
        setIsWaiting(false);
      }
    },
    [taggingAsync, taggedRows, mentions, isTagging],
  );

  const send = useCallback(
    (turn: UserTurn) =>
      session !== undefined &&
      session.send(
        { ...turn, content: turn.content.slice(0, CHAT_LIMITS.message) },
        () => readContextAsync(session),
        chatAsync,
      ) !== null,
    [session, readContextAsync],
  );

  // The server puts the user's More like this instruction before the option.
  const moreLikeThis = useCallback(
    (text: string) => send({ label: MORE_LIKE_THIS, content: text, moreLikeThis: true }),
    [send],
  );

  const retry = useCallback(
    () => session !== undefined && session.retry(() => readContextAsync(session), chatAsync) !== null,
    [session, readContextAsync],
  );

  return { chat, assets, tagging, mentions, isWaiting, send, moreLikeThis, retry };
}

export type PostChatState = ReturnType<typeof usePostChat>;
