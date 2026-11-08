import { CHAT_LIMITS } from '@squidbox/shared';
import { useMemo, useRef, useState } from 'react';

import chatMentions from './chatMentions';
import type { ContextReader, UserTurn } from './chatSessions';
import postTags from './postTags';
import useChatSession from './useChatSession';
import useMentions from './useMentions';

import useAssetTags from '@/features/photo-tags/useAssetTags';
import useLatestRef from '@/hooks/useLatestRef';
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
  const session = chat?.session;
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
  // Read when a turn goes, so the sends don't change with the photos' tags or the mentions.
  const latest = useLatestRef({ tagging, mentions });

  // Counts the context reads: only the newest one clears `isWaiting`.
  const readCount = useRef(0);

  // The sends, built once per chat (they keep their identity while its state changes). The context
  // is what the chat is about when the turn goes: the editor's latest caption and assets, the post's
  // tags (their tags, read again once a tagging under way landed, with the card's edits: postTags)
  // and the handles found in their albums' posts. It waits for the photos being tagged (`isWaiting`
  // meanwhile, until the read ends or its turn is dropped).
  const { send, moreLikeThis, retry } = useMemo(() => {
    if (!session) return { send: () => false, moreLikeThis: () => false, retry: () => false };
    const readContext: ContextReader = async (signal) => {
      const read = ++readCount.current;
      const finish = () => {
        if (readCount.current === read) setIsWaiting(false);
      };
      signal.addEventListener('abort', finish);
      try {
        const hasWaited = await latest.current.tagging.taggingAsync(() => setIsWaiting(true));
        if (signal.aborted) throw new Error('The turn was dropped');
        const {
          tagging: { rows: taggedRows },
          mentions: currentMentions,
        } = latest.current;
        const { text, assets: now } = session.getDraft();
        const { kind, tagEdits } = session.getState();
        const ids = now.map((asset) => asset.id);
        const isCurrent = taggedRows?.length === ids.length && ids.every((id, index) => taggedRows[index].id === id);
        const rows = hasWaited || !isCurrent ? await readLiveAssets(getDb(), ids) : taggedRows;
        return {
          kind,
          text: text.slice(0, CHAT_LIMITS.text),
          media: countMediaTypes(now),
          tags: postTags(rows, tagEdits).slice(0, CHAT_LIMITS.tags),
          mentions: currentMentions?.handles ?? [],
        };
      } finally {
        signal.removeEventListener('abort', finish);
        finish();
      }
    };

    const sendTurn = (turn: UserTurn) =>
      session.send({ ...turn, content: turn.content.slice(0, CHAT_LIMITS.message) }, readContext, chatAsync) !== null;

    return {
      send: sendTurn,
      // The server puts the user's More like this instruction before the option.
      moreLikeThis: (text: string) => sendTurn({ label: MORE_LIKE_THIS, content: text, moreLikeThis: true }),
      retry: () => session.retry(readContext, chatAsync) !== null,
    };
  }, [session, latest]);

  return { chat, assets, tagging, mentions, isWaiting, send, moreLikeThis, retry };
}

export type PostChatState = ReturnType<typeof usePostChat>;
