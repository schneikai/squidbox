import { useMemo, useSyncExternalStore } from 'react';

import chatSessions from './chatSessions';

import chatAsync from '@/utils/cloud-api/ai/chatAsync';

const subscribeNone = () => () => {};
const getNone = () => null;

/**
 * The chat with this id (chatSessions), live: its state, its draft (`getDraft()`) and its actions
 * (`editTags(edit)` among them),
 * `send(turn, context)` and `retry(context)` asking the server (POST /ai/chat; each → the reply's
 * promise, or null when nothing was sent). null when there is no such chat (closed, or no id yet).
 */
export default function useChatSession(id) {
  const session = id ? chatSessions.get(id) : undefined;
  const state = useSyncExternalStore(session?.subscribe ?? subscribeNone, session?.getState ?? getNone);

  return useMemo(() => {
    if (!session || !state) return null;
    return {
      ...state,
      getDraft: session.getDraft,
      send: (turn, context) => session.send(turn, context, chatAsync),
      retry: (context) => session.retry(context, chatAsync),
      reset: session.reset,
      applyText: session.applyText,
      editTags: session.editTags,
    };
  }, [session, state]);
}
