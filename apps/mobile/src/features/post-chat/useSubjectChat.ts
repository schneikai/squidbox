import type { ChatSubjectKind } from '@squidbox/shared';
import { useEffect, useState } from 'react';

import chatSessions, { type ChatDraftPost } from './chatSessions';

type SubjectChatOptions = {
  kind: ChatSubjectKind;
  posts: ChatDraftPost[];
  activeKey: string;
  setText?: ((key: string, text: string) => void) | null;
};

/**
 * The one assistant chat about a post and its thread (`kind`, chatSubjectKindSchema): opened with the
 * screen that shows it (its editor, or a posted post) and closed with it, told the posts (`posts`,
 * `{ key, text, assets }` in the thread's order) and the one being edited (`activeKey`) as they
 * change, and given `setText(key, text)` for Use (none for a posted post: its options have Copy).
 * → the chat's id, null until it is open.
 */
export default function useSubjectChat({ kind, posts, activeKey, setText = null }: SubjectChatOptions): string | null {
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Opened and closed by one effect, so an effect run again (Fast Refresh) opens a new chat.
  useEffect(() => {
    const id = chatSessions.open({ kind });
    setSessionId(id);
    return () => chatSessions.close(id);
  }, [kind]);

  useEffect(() => {
    chatSessions.get(sessionId)?.setDraft({ posts });
  }, [sessionId, posts]);

  useEffect(() => {
    chatSessions.get(sessionId)?.setActiveTarget(activeKey);
  }, [sessionId, activeKey]);

  useEffect(() => {
    const session = chatSessions.get(sessionId);
    session?.setTextApplier(setText);
    return () => session?.setTextApplier(null);
  }, [sessionId, setText]);

  return sessionId;
}
