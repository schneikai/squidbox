import { CHAT_LIMITS, uniqueTags } from '@squidbox/shared';
import { useCallback, useMemo, useState } from 'react';

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
 * The assistant chat about a post (`sessionId`, chatSession's), for a screen that shows it: the chat
 * (useChatSession; null once closed), its post's `assets`, their `tagging` (useAssetTags) and the
 * `mentions` (useMentions), and the sends: `send(turn)` waits for the photos being tagged
 * (`isWaiting`), then sends with the post as it is then; it resolves to whether the turn went.
 * `sendButton(button)`, `moreLikeThis(text)` and `retry()` (the last reply, after it failed).
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

  // What the chat is about as it is now: the editor's latest caption and assets, their tags (read
  // again once a tagging under way landed) and the handles found in their albums' posts.
  const readContextAsync = useCallback(async () => {
    if (!chat) return null;
    const hasWaited = await tagging.taggingAsync();
    const { text, assets: now } = chat.getDraft();
    const ids = now.map((asset) => asset.id);
    const isCurrent = tagging.rows && ids.every((id, index) => tagging.rows[index]?.id === id);
    const rows = hasWaited || !isCurrent ? await readLiveAssets(getDb(), ids) : tagging.rows;
    return {
      kind: chat.kind,
      text: text.slice(0, CHAT_LIMITS.text),
      media: countMediaTypes(now),
      tags: uniqueTags(rows.flatMap((row) => row.tags ?? [])).slice(0, CHAT_LIMITS.tags),
      mentions: (mentions?.handles ?? [])
        .filter((handle) => handle.length <= CHAT_LIMITS.mention)
        .slice(0, CHAT_LIMITS.mentions),
    };
  }, [chat, tagging, mentions]);

  const send = useCallback(
    async (turn) => {
      if (!chat || chat.isSending || isWaiting) return false;
      setIsWaiting(tagging.isTagging);
      try {
        const context = await readContextAsync();
        if (!context) return false;
        chat.send(turn, context);
        return true;
      } finally {
        setIsWaiting(false);
      }
    },
    [chat, isWaiting, tagging.isTagging, readContextAsync],
  );

  const sendButton = useCallback((button) => send(promptTurn(button)), [send]);

  const moreLikeThis = useCallback(
    (text) => instructions && send({ label: MORE_LIKE_THIS, content: `${instructions.moreLikeThis}\n\n${text}` }),
    [send, instructions],
  );

  const retry = useCallback(async () => {
    const context = await readContextAsync();
    if (context) chat.retry(context);
  }, [chat, readContextAsync]);

  return { chat, assets, tagging, mentions, isWaiting, send, sendButton, moreLikeThis, retry };
}
