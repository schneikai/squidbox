import { CHAT_LIMITS } from '@squidbox/shared';
import { useMemo } from 'react';

import chatContextReader from './chatContextReader';
import chatSessions, { type UserTurn } from './chatSessions';
import chatTags from './chatTags';
import useLatestRef from './useLatestRef';

import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import chatAsync from '@/utils/cloud-api/ai/chatAsync';

const MORE_LIKE_THIS = 'More like this';

/**
 * The sends of the chat `sessionId` (chatSessions'), without watching its state, so a screen that
 * only sends (the post editor's auto-start) doesn't render with each change: `send(turn)` puts the
 * turn (cut to CHAT_LIMITS.message) in the chat at once and returns whether it went (false: a reply
 * loads, the chat is closed, or there is none yet); the context is read then (chatContextReader),
 * with the posts as they are then, after tagging their photos (chatTags.tagMissingAsync; the chat's
 * `isWaiting` meanwhile). `moreLikeThis(text, target)` and `retry()` (the last reply, after it
 * failed) do the same. They keep their identity all chat long.
 */
export default function useChatSends(sessionId: string | null) {
  const session = chatSessions.get(sessionId);
  const isAvailable = useIsAssistantAvailable();
  const deps = useVisionImageDeps();
  // Read when a turn goes, so the sends don't change with them.
  const latest = useLatestRef({ deps, isAvailable });

  return useMemo(() => {
    if (!session) return { send: () => false, moreLikeThis: () => false, retry: () => false };
    const readContext = chatContextReader(session, () => ({
      tagging: {
        tagMissingAsync: (ids: readonly string[], onWait?: () => void) =>
          chatTags.tagMissingAsync(ids, latest.current, onWait),
      },
    }));

    const send = (turn: UserTurn) =>
      session.send({ ...turn, content: turn.content.slice(0, CHAT_LIMITS.message) }, readContext, chatAsync) !== null;

    return {
      send,
      // The server puts the user's More like this instruction before the option.
      moreLikeThis: (text: string, target: string) =>
        send({ label: MORE_LIKE_THIS, content: text, kind: 'moreLikeThis', target }),
      retry: () => session.retry(readContext, chatAsync) !== null,
    };
  }, [session, latest]);
}
