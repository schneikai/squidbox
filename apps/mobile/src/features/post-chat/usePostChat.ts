import { CHAT_LIMITS } from '@squidbox/shared';
import { useMemo } from 'react';

import chatContextReader from './chatContextReader';
import type { UserTurn } from './chatSessions';
import sentMentions from './sentMentions';
import useChatSession from './useChatSession';
import useLatestRef from './useLatestRef';
import useMentions from './useMentions';

import useAssetTags from '@/features/photo-tags/useAssetTags';
import chatAsync from '@/utils/cloud-api/ai/chatAsync';

const MORE_LIKE_THIS = 'More like this';

/**
 * The assistant chat about a post (`sessionId`, chatSessions'), for a screen that shows it: the chat
 * (useChatSession; null once closed), its post's `assets`, their `tagging` (useAssetTags), the
 * `mentions` (those it sends, useMentions' with the chat's mentionEdits) and the sends: `send(turn)`
 * puts the turn (cut to CHAT_LIMITS.message) in the chat at once and returns whether it went (false:
 * a reply loads, or the chat is closed); the context is read then (chatContextReader), with the post
 * as it is then, waiting for the photos being tagged (the chat's `isWaiting` meanwhile).
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
  // The handles the chat may mention and sends: sentMentions'.
  const mentions = useMemo(
    () => found && mentionEdits && { handles: sentMentions(found, mentionEdits), fromAlbum: found.fromAlbum },
    [found, mentionEdits],
  );
  // Read when a turn goes, so the sends don't change with the photos' tags or the mentions.
  const latest = useLatestRef({ tagging, found });

  // The sends, built once per chat: they keep their identity while its state changes.
  const { send, moreLikeThis, retry } = useMemo(() => {
    if (!session) return { send: () => false, moreLikeThis: () => false, retry: () => false };
    const readContext = chatContextReader(session, () => latest.current);

    const sendTurn = (turn: UserTurn) =>
      session.send({ ...turn, content: turn.content.slice(0, CHAT_LIMITS.message) }, readContext, chatAsync) !== null;

    return {
      send: sendTurn,
      // The server puts the user's More like this instruction before the option.
      moreLikeThis: (text: string) => sendTurn({ label: MORE_LIKE_THIS, content: text, moreLikeThis: true }),
      retry: () => session.retry(readContext, chatAsync) !== null,
    };
  }, [session, latest]);

  return { chat, assets, tagging, mentions, send, moreLikeThis, retry };
}

export type PostChatState = ReturnType<typeof usePostChat>;
