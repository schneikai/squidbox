import { useMemo, useSyncExternalStore } from 'react';

import chatSessions from './chatSessions';

const subscribeNone = () => () => {};
const getNone = () => null;

/**
 * The chat with this id (chatSessions), live: its state, its draft (`getDraft()`) and its actions
 * (`editTags(edit)` and `editMentions(edit)` among them). null when there is no such chat (closed,
 * or no id yet).
 */
export default function useChatSession(id: string | null) {
  const session = chatSessions.get(id);
  const state = useSyncExternalStore(session?.subscribe ?? subscribeNone, session?.getState ?? getNone);

  return useMemo(() => {
    if (!session || !state || state.isClosed) return null;
    const { isClosed: _isClosed, ...live } = state;
    return {
      ...live,
      getDraft: session.getDraft,
      reset: session.reset,
      applyText: session.applyText,
      editTags: session.editTags,
      editMentions: session.editMentions,
    };
  }, [session, state]);
}

export type LiveChat = NonNullable<ReturnType<typeof useChatSession>>;
