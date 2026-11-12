import { useMemo } from 'react';

import sentMentions from './sentMentions';
import useChatSends from './useChatSends';
import useChatSession from './useChatSession';
import useChatTags from './useChatTags';
import useMentions from './useMentions';

type PostChatOptions = {
  // Tags the photos never tagged as they show (the chat screen), not only when a turn goes.
  tagsOnOpen?: boolean;
};

/**
 * The assistant chat about a post and its thread (`sessionId`, chatSessions'), for the chat screen:
 * the chat (useChatSession; null once closed), the `assets` of all its posts, their `tagging`
 * (useChatTags, with `tagsOnOpen`), the `mentions` (those it sends, useMentions' with the chat's
 * mentionEdits) and its sends (useChatSends: `send(turn)`, `moreLikeThis(text, target)`, `retry()`).
 */
export default function usePostChat(sessionId: string | null, { tagsOnOpen = false }: PostChatOptions = {}) {
  const chat = useChatSession(sessionId);
  const assets = useMemo(() => chat?.assets ?? [], [chat?.assets]);
  const assetIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const tagging = useChatTags(assets, { tagsOnOpen });
  const found = useMentions(assetIds);
  const mentionEdits = chat?.mentionEdits;
  // The handles the chat may mention and sends: sentMentions'.
  const mentions = useMemo(
    () => found && mentionEdits && { handles: sentMentions(found, mentionEdits), fromAlbum: found.fromAlbum },
    [found, mentionEdits],
  );
  const { send, moreLikeThis, retry } = useChatSends(sessionId);

  return { chat, assets, tagging, mentions, send, moreLikeThis, retry };
}

export type PostChatState = ReturnType<typeof usePostChat>;
