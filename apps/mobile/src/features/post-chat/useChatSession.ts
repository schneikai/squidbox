import { useMemo, useSyncExternalStore } from 'react';

import chatSessions, { type ChatSession } from './chatSessions';

const subscribeNone = () => () => {};
const getNone = () => null;

// The state as a screen sees it: a closed chat is none, so it is never closed.
type LiveState = Omit<ReturnType<ChatSession['getState']>, 'isClosed'>;

/**
 * The chat with this id (chatSessions), live: its state, its draft (`getDraft()`) and its actions
 * (`editTags(edit)` and `editMentions(edit)` among them), and `session`, the chat itself, the same
 * object all chat long (for what must keep its identity while the state changes). null when there
 * is no such chat (closed, or no id yet).
 */
export default function useChatSession(id: string | null) {
  const session = chatSessions.get(id);
  const state = useSyncExternalStore(session?.subscribe ?? subscribeNone, session?.getState ?? getNone);

  return useMemo(() => {
    if (!session || !state || state.isClosed) return null;
    const live: LiveState = state;
    return {
      ...live,
      session,
      getDraft: session.getDraft,
      reset: session.reset,
      applyText: session.applyText,
      editTags: session.editTags,
      editMentions: session.editMentions,
    };
  }, [session, state]);
}

export type LiveChat = NonNullable<ReturnType<typeof useChatSession>>;
