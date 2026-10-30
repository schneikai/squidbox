import { CHAT_LIMITS, uniqueTags } from '@squidbox/shared';

import createStore from '@/lib/createStore';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import tagKey from '@/utils/tagKey';

const NO_TAG_EDITS = Object.freeze({ addedTags: [], removedTags: [] });
const NO_MENTION_EDITS = Object.freeze({ added: [], removed: [] });

// The open assistant chats by id. A chat lives while its editor is open and is never saved: the
// editor and the chat screen (a route, whose params are plain data) share it by id.
const sessions = new Map();
let lastId = 0;

/** Opens a chat about a post (`kind`, chatSubjectKindSchema) and returns its id. */
function open({ kind }) {
  const id = `chat-${++lastId}`;
  sessions.set(id, createSession(kind));
  return id;
}

/** Stops the reply under way, if any, and forgets the chat. */
function close(id) {
  sessions.get(id)?.close();
  sessions.delete(id);
}

/**
 * The open chats: `open({ kind })` → its id, `close(id)`, and `get(id)` (the chat, or undefined
 * once it was closed).
 */
const chatSessions = { open, close, get: (id) => sessions.get(id) };

export default chatSessions;

// The transcript as the server takes it: the user's turns and the assistant's answered replies,
// oldest first (a reply loading or failed is left out, and a turn the server refused as invalid with
// its reply, so it doesn't fail every later send), the newest CHAT_LIMITS.messages of them, starting
// with a user turn (a reply the cut left first goes too). A reply goes as `{ reply, postOptions }`, as
// it came.
function wireTurns(messages) {
  const turns = messages.flatMap((message, index) => {
    if (message.role === 'user') {
      const reply = messages[index + 1];
      if (reply?.status === 'error' && reply.errorStatus === 400) return [];
      return [{ role: 'user', content: message.content, ...(message.moreLikeThis && { moreLikeThis: true }) }];
    }
    return message.status === 'done'
      ? [{ role: 'assistant', reply: message.reply, postOptions: message.postOptions }]
      : [];
  });
  const newest = turns.slice(-CHAT_LIMITS.messages);
  return newest[0]?.role === 'assistant' ? newest.slice(1) : newest;
}

/**
 * One chat: `getState()` → `{ kind, messages, isSending, canApply }`, a new object on each change,
 * which `subscribe(listener)` tells. A message is the user's `{ id, role: 'user', label, content,
 * moreLikeThis }` (`label`: the prompt button's name, or null for a typed message; `moreLikeThis`:
 * More like this on the option `content`, which the server puts its instruction before) or a reply `{ id, role:
 * 'assistant', status: 'loading' | 'done' | 'error', reply, postOptions, error, errorStatus }`
 * (`reply`: what the assistant says; `postOptions`: the options for the post, when the user asked for
 * posts; `errorStatus`: the failed request's HTTP status, if any). `isSending` while a reply loads.
 * The editor's caption and assets (`getDraft()`) change with every keystroke, so they are read when
 * needed, not told. `tagEdits` (`{ addedTags, removedTags }`) is what the chat card changed in the
 * post's tags (postTags): kept here only, while the editor is open, never on the photos.
 * `mentionEdits` (`{ added, removed }`) is the same for the handles it may mention (chatMentions),
 * never on the posts.
 */
function createSession(kind) {
  const store = createStore({
    kind,
    messages: [],
    isSending: false,
    canApply: false,
    tagEdits: NO_TAG_EDITS,
    mentionEdits: NO_MENTION_EDITS,
  });
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
      const { reply, postOptions } = await request(body, { signal });
      if (!signal.aborted) replaceMessage(replyId, { status: 'done', reply, postOptions });
    } catch (error) {
      if (!signal.aborted) {
        replaceMessage(replyId, {
          status: 'error',
          error: apiErrorMessage(error),
          errorStatus: error?.response?.status ?? null,
        });
      }
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
     * Sends the user's turn (`{ label, content, moreLikeThis }`) about `context` (chatContextSchema) through
     * `request(body, { signal })`, which resolves to the reply, `{ reply, postOptions }`. → the
     * reply's promise, or null when nothing was sent (a reply is loading, or the chat was closed).
     */
    send({ label = null, content, moreLikeThis = false }, context, request) {
      if (store.get().isSending || isClosed) return null;
      const userMessage = { id: `m${++lastMessageId}`, role: 'user', label, content, moreLikeThis };
      const reply = {
        id: `m${++lastMessageId}`,
        role: 'assistant',
        status: 'loading',
        reply: '',
        postOptions: [],
        error: null,
        errorStatus: null,
      };
      update({ messages: [...store.get().messages, userMessage, reply] });
      return requestReply(reply.id, context, request);
    },

    /** Asks again for the last reply, after it failed. → as `send`. */
    retry(context, request) {
      const { messages, isSending } = store.get();
      const last = messages[messages.length - 1];
      if (isSending || isClosed || last?.role !== 'assistant' || last.status !== 'error') return null;
      replaceMessage(last.id, { status: 'loading', error: null, errorStatus: null });
      return requestReply(last.id, context, request);
    },

    /** The card's change to the post's tags (`{ add, remove }`), as editedLists says. */
    editTags(edit) {
      const { addedTags, removedTags } = store.get().tagEdits;
      const [added, removed] = editedLists([addedTags, removedTags], edit);
      update({ tagEdits: { addedTags: added, removedTags: removed } });
    },

    /** The Mentions sheet's change to the handles (`{ add, remove }`), as editedLists says. */
    editMentions({ add = [], remove = [] }) {
      const { added, removed } = store.get().mentionEdits;
      const [nextAdded, nextRemoved] = editedLists([added, removed], { add: add.map(asHandle), remove });
      update({ mentionEdits: { added: nextAdded, removed: nextRemoved } });
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

/**
 * The added and removed lists (`[added, removed]`) after a change (`{ add, remove }`): an item taken
 * off goes on the removed list (and off the added one), one added the other way round, in any case.
 */
function editedLists([added, removed], { add = [], remove = [] }) {
  const without = (list, items) => {
    const keys = new Set(items.map(tagKey));
    return list.filter((item) => !keys.has(tagKey(item)));
  };
  return [uniqueTags([...without(added, remove), ...add]), uniqueTags([...without(removed, add), ...remove])];
}

// A handle as typed, with its @ and without spaces.
function asHandle(text) {
  const handle = text.replace(/\s+/g, '');
  return handle.startsWith('@') ? handle : `@${handle}`;
}
