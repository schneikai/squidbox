import { useCallback, useSyncExternalStore } from 'react';

import { getChatSession } from './chatSession';

import chatAsync from '@/utils/cloud-api/ai/chatAsync';

const subscribeNone = () => () => {};
const getNone = () => null;

/**
 * The chat with this id (chatSession), live: its state and actions, `send(turn, context)` and
 * `retry(context)` asking the server (POST /ai/chat). null once the chat was closed.
 */
export default function useChatSession(id) {
  const session = getChatSession(id);
  const subscribe = useCallback((listener) => session?.subscribe(listener) ?? (() => {}), [session]);
  const state = useSyncExternalStore(session ? subscribe : subscribeNone, session ? session.getState : getNone);

  if (!session || !state) return null;
  return {
    ...state,
    send: (turn, context) => session.send(turn, context, chatAsync),
    retry: (context) => session.retry(context, chatAsync),
    reset: session.reset,
    applyText: session.applyText,
  };
}
