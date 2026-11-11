import { useCallback, useState } from 'react';

import usePostChat from '@/features/post-chat/usePostChat';

/**
 * What the trays of one screen share: its chat (usePostChat) and, by post, where Back closed the
 * tray's run (`closedAt`: the id of the chat's last message then; ideasRun shows only a run started
 * after it). `closeIdeas(target)` is Back. New chat empties the chat, so nothing to clear then.
 */
export default function usePostIdeas(sessionId: string | null) {
  const postChat = usePostChat(sessionId);
  const [closedAt, setClosedAt] = useState<Partial<Record<string, string>>>({});
  const messages = postChat.chat?.messages;

  const closeIdeas = useCallback(
    (target: string) => {
      const last = messages?.[messages.length - 1];
      if (last) setClosedAt((current) => ({ ...current, [target]: last.id }));
    },
    [messages],
  );

  return { ...postChat, sessionId, closedAt, closeIdeas };
}

export type PostIdeas = ReturnType<typeof usePostIdeas>;
