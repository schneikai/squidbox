import { CHAT_LIMITS } from '@squidbox/shared';

import createStore from '@/lib/createStore';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The open assistant chats by id. A chat lives while its editor is open and is never saved: the
// editor and the chat screen (a route, whose params are plain data) share it by id.
const sessions = new Map();
let lastId = 0;

/** Opens a chat about a post being written (`kind`, chatSubjectKindSchema) and returns its id. */
export function openChatSession({ kind }) {
  const id = `chat-${++lastId}`;
  sessions.set(id, createSession(kind));
  return id;
}

/** Stops the reply under way, if any, and forgets the chat. */
export function closeChatSession(id) {
  sessions.get(id)?.close();
  sessions.delete(id);
}

/** The chat with this id, or undefined once it was closed. */
export function getChatSession(id) {
  return sessions.get(id);
}

// The transcript as the server takes it: the user's turns and the assistant's answered replies,
// oldest first (a reply loading or failed is left out), the newest CHAT_LIMITS.messages of them.
function wireTurns(messages) {
  const turns = messages.flatMap((message) => {
    if (message.role === 'user') return [{ role: 'user', content: message.content }];
    return message.status === 'done' ? [{ role: 'assistant', tweets: message.tweets }] : [];
  });
  return turns.slice(-CHAT_LIMITS.messages);
}

/**
 * One chat: `getState()` → `{ kind, messages, isSending, canApply }`, a new object on each change,
 * which `subscribe(listener)` tells. A message is the user's `{ id, role: 'user', label, content }`
 * (`label`: the prompt button's name, or null for a typed message) or a reply `{ id, role:
 * 'assistant', status: 'loading' | 'done' | 'error', tweets, error }`. `isSending` while a reply
 * loads. The editor's caption and assets (`getDraft()`) change with every keystroke, so they are
 * read when needed, not told.
 */
function createSession(kind) {
  const store = createStore({ kind, messages: [], isSending: false, canApply: false });
  let draft = { text: '', assets: [] };
  let applier = null;
  let controller = null;
  let isClosed = false;
  let lastMessageId = 0;

  function update(changes) {
    if (isClosed) return;
    store.set((state) => {
      const next = { ...state, ...changes };
      return { ...next, isSending: next.messages.some((message) => message.status === 'loading') };
    });
  }

  function replaceMessage(id, changes) {
    update({
      messages: store.get().messages.map((message) => (message.id === id ? { ...message, ...changes } : message)),
    });
  }

  // Asks for the reply `replyId` to the messages before it, and lands the answer on it.
  async function requestReply(replyId, context, request) {
    controller = new AbortController();
    const { signal } = controller;
    const { messages } = store.get();
    const at = messages.findIndex((message) => message.id === replyId);
    const body = { context, messages: wireTurns(messages.slice(0, at)) };
    try {
      const tweets = await request(body, { signal });
      if (!signal.aborted) replaceMessage(replyId, { status: 'done', tweets });
    } catch (error) {
      if (!signal.aborted) replaceMessage(replyId, { status: 'error', error: apiErrorMessage(error) });
    } finally {
      if (controller?.signal === signal) controller = null;
    }
  }

  return {
    getState: store.get,
    subscribe: store.subscribe,

    /** The editor's caption and assets (`asset` rows) as they are now. */
    getDraft: () => draft,

    setDraft(next) {
      draft = next;
    },

    /** How Use puts an option into the caption (the editor's), or null: the option is copied instead. */
    setTextApplier(fn) {
      applier = fn;
      update({ canApply: Boolean(fn) });
    },

    applyText(text) {
      applier?.(text);
    },

    /**
     * Sends the user's turn (`{ label, content }`) about `context` (chatContextSchema) through
     * `request(body, { signal })`, which resolves to the reply's posts. Nothing while a reply loads.
     */
    send({ label = null, content }, context, request) {
      if (store.get().isSending || isClosed) return;
      const userMessage = { id: `m${++lastMessageId}`, role: 'user', label, content };
      const reply = { id: `m${++lastMessageId}`, role: 'assistant', status: 'loading', tweets: [], error: null };
      update({ messages: [...store.get().messages, userMessage, reply] });
      return requestReply(reply.id, context, request);
    },

    /** Asks again for the last reply, after it failed. */
    retry(context, request) {
      const { messages, isSending } = store.get();
      const last = messages[messages.length - 1];
      if (isSending || isClosed || last?.role !== 'assistant' || last.status !== 'error') return;
      replaceMessage(last.id, { status: 'loading', error: null });
      return requestReply(last.id, context, request);
    },

    /** Starts over (New chat): the reply under way, if any, is dropped. */
    reset() {
      controller?.abort();
      controller = null;
      update({ messages: [] });
    },

    close() {
      controller?.abort();
      isClosed = true;
    },
  };
}
