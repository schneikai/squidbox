import {
  type AssetRecord,
  CHAT_LIMITS,
  type ChatContext,
  type ChatReply,
  type ChatRequest,
  type ChatResponse,
  type ChatSubjectKind,
  type ChatTurn,
} from '@squidbox/shared';

import withEdits, { type ListEdits } from './withEdits';

import createStore from '@/lib/createStore';
import type chatAsync from '@/utils/cloud-api/ai/chatAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import errorResponse from '@/utils/cloud-api/errorResponse';
import getNewItemId from '@/utils/getNewItemId';
import type { TagsEdit } from '@/utils/tagsDifference';

type UserChatTurn = Extract<ChatTurn, { role: 'user' }>;

/**
 * The user's turn as `send` takes it: the wire turn's `content` and `moreLikeThis` (More like this on
 * the option `content`, which the server puts its instruction before), with `label`, the prompt
 * button's name, or none for a typed message.
 */
export type UserTurn = Omit<UserChatTurn, 'role'> & { label?: string | null };

// What waits in the composer: a prompt button's turn (promptTurn), or what was typed.
export type ChatSeed = Pick<UserTurn, 'label' | 'content'>;

export type UserChatMessage = Required<UserChatTurn> & { id: string; label: string | null };

/**
 * A reply: `reply`, what the assistant says; `postOptions`, the options for the post, when the user
 * asked for posts; `systemMessage`, what the model was told, for an ai_admin, else null;
 * `errorStatus`, the failed request's HTTP status, if any.
 */
export type AssistantChatMessage = ChatReply & {
  id: string;
  role: 'assistant';
  status: 'loading' | 'done' | 'error';
  systemMessage: Exclude<ChatResponse['systemMessage'], undefined> | null;
  error: string | null;
  errorStatus: number | null;
};

// A message narrows by its `role`: only a reply has a status.
export type ChatMessage = UserChatMessage | AssistantChatMessage;

type ChatSessionState = {
  kind: ChatSubjectKind;
  messages: ChatMessage[];
  isSending: boolean;
  // While the turn's context waits for the photos' tags.
  isWaiting: boolean;
  canApply: boolean;
  tagEdits: ListEdits;
  mentionEdits: ListEdits;
  // Once the chat was closed: a screen showing it goes.
  isClosed: boolean;
};

type ChatDraft = { text: string; assets: AssetRecord[] };

type ChatRequester = typeof chatAsync;

export type ChatSession = ReturnType<typeof createSession>;

/**
 * What the chat is about, read when the turn goes: it may wait for the photos' tags, and calls
 * `onWait()` when it does (the chat is `isWaiting` until the read ends). `signal` aborts once the
 * turn is dropped (New chat, or the chat closed); what it resolves to then is ignored.
 */
export type ContextReader = (signal: AbortSignal, onWait: () => void) => Promise<ChatContext>;

const NO_EDITS: ListEdits = Object.freeze({ added: [], removed: [] });

// The open assistant chats by id. A chat lives while its post's editor or screen is open and is never
// saved: that screen and the chat screen (a route, whose params are plain data) share it by id.
const sessions = new Map<string, ChatSession>();
let lastId = 0;

/** Opens a chat about a post (`kind`, chatSubjectKindSchema) and returns its id. */
function open({ kind }: { kind: ChatSubjectKind }): string {
  const id = `chat-${++lastId}`;
  sessions.set(id, createSession(kind));
  return id;
}

/** Stops the reply under way, if any, and forgets the chat. */
function close(id: string) {
  sessions.get(id)?.close();
  sessions.delete(id);
}

/**
 * The open chats: `open({ kind })` → its id, `close(id)`, and `get(id)` (the chat, or undefined
 * once it was closed, or for no id yet).
 */
const chatSessions = { open, close, get: (id: string | null) => (id === null ? undefined : sessions.get(id)) };

export default chatSessions;

// The transcript as the server takes it: the user's turns and the assistant's answered replies,
// oldest first (a reply loading or failed is left out, and a turn the server refused as invalid with
// its reply, so it doesn't fail every later send), the newest CHAT_LIMITS.messages of them, starting
// with a user turn (a reply the cut left first goes too). A reply goes as `{ reply, postOptions }`, as
// it came.
function wireTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns = messages.flatMap((message, index): ChatTurn[] => {
    if (message.role === 'user') {
      const reply = messages[index + 1];
      if (isReply(reply) && reply.status === 'error' && reply.errorStatus === 400) return [];
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
 * One chat: `getState()` → `{ kind, messages, isSending, isWaiting, canApply, isClosed }`, a new
 * object on each change, which `subscribe(listener)` tells. A message is the user's
 * (UserChatMessage) or a reply (AssistantChatMessage). `isSending` while a reply loads; `isWaiting`
 * while its context waits for the photos' tags. `isClosed` once the chat was closed (its last
 * change). `send` and `retry` put the turn in the chat at once and read the context when they go.
 * The editor's caption and assets (`getDraft()`) change with every keystroke, so they are read when
 * needed, not told. `tagEdits` is what the chat card changed in the post's tags (postTags): kept
 * here only, while the editor is open, never on the photos. `mentionEdits` is the same for the
 * handles it may mention (chatMentions), never on the posts.
 */
function createSession(kind: ChatSubjectKind) {
  const store = createStore<ChatSessionState>({
    kind,
    messages: [],
    isSending: false,
    isWaiting: false,
    canApply: false,
    tagEdits: NO_EDITS,
    mentionEdits: NO_EDITS,
    isClosed: false,
  });
  let draft: ChatDraft = { text: '', assets: [] };
  let applier: ((text: string) => void) | null = null;
  let controller: AbortController | null = null;
  // Sent with each turn: it picks the posts of the user's that the server quotes, the same all chat
  // long; New chat picks others.
  let chatId = getNewItemId();
  let lastMessageId = 0;

  function update(changes: Partial<ChatSessionState>) {
    if (store.get().isClosed) return;
    store.set((state) => {
      const next = { ...state, ...changes };
      return {
        ...next,
        isSending: next.messages.some((message) => isReply(message) && message.status === 'loading'),
      };
    });
  }

  function replaceMessage(id: string, changes: Partial<AssistantChatMessage>) {
    update({
      messages: store
        .get()
        .messages.map((message) => (message.id === id && isReply(message) ? { ...message, ...changes } : message)),
    });
  }

  // Asks for the reply `replyId` to the messages before it, about the context `readContext` reads,
  // and lands the answer (or the failure to read the context) on it.
  async function requestReply(replyId: string, readContext: ContextReader, request: ChatRequester) {
    controller = new AbortController();
    const { signal } = controller;
    try {
      const context = await readContext(signal, () => {
        if (!signal.aborted) update({ isWaiting: true });
      }).finally(() => {
        // A dropped read leaves it to reset() or close(), and to the read after it.
        if (!signal.aborted && store.get().isWaiting) update({ isWaiting: false });
      });
      if (signal.aborted) return;
      const { messages } = store.get();
      const at = messages.findIndex((message) => message.id === replyId);
      const body: ChatRequest = { chatId, context, messages: wireTurns(messages.slice(0, at)) };
      const { reply, postOptions, systemMessage = null } = await request(body, { signal });
      if (!signal.aborted) replaceMessage(replyId, { status: 'done', reply, postOptions, systemMessage });
    } catch (error) {
      if (!signal.aborted) {
        replaceMessage(replyId, {
          status: 'error',
          error: apiErrorMessage(error),
          errorStatus: errorResponse(error)?.status ?? null,
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

    setDraft(next: ChatDraft) {
      draft = next;
    },

    /** How Use puts an option into the caption (the editor's), or null: the option is copied instead. */
    setTextApplier(fn: ((text: string) => void) | null) {
      applier = fn;
      update({ canApply: Boolean(fn) });
    },

    applyText(text: string) {
      applier?.(text);
    },

    /**
     * Puts the user's turn and its loading reply in the chat, then sends it about the context
     * `readContext(signal)` resolves to (chatContextSchema) through `request(body, { signal })`, which
     * resolves to the reply, `{ reply, postOptions }`. → the reply's promise, or null when nothing was
     * sent (a reply is loading, or the chat was closed).
     */
    send(
      { label = null, content, moreLikeThis = false }: UserTurn,
      readContext: ContextReader,
      request: ChatRequester,
    ) {
      const { isSending, isClosed } = store.get();
      if (isSending || isClosed) return null;
      const userMessage: UserChatMessage = { id: `m${++lastMessageId}`, role: 'user', label, content, moreLikeThis };
      const reply: AssistantChatMessage = {
        id: `m${++lastMessageId}`,
        role: 'assistant',
        status: 'loading',
        reply: '',
        postOptions: [],
        systemMessage: null,
        error: null,
        errorStatus: null,
      };
      update({ messages: [...store.get().messages, userMessage, reply] });
      return requestReply(reply.id, readContext, request);
    },

    /** Asks again for the last reply, after it failed. → as `send`. */
    retry(readContext: ContextReader, request: ChatRequester) {
      const { messages, isSending, isClosed } = store.get();
      const last = messages[messages.length - 1];
      if (isSending || isClosed || !isReply(last) || last.status !== 'error') return null;
      replaceMessage(last.id, { status: 'loading', error: null, errorStatus: null });
      return requestReply(last.id, readContext, request);
    },

    /** The card's change to the post's tags, as editedLists says. */
    editTags(edit: Partial<TagsEdit>) {
      update({ tagEdits: editedLists(store.get().tagEdits, edit) });
    },

    /** The Mentions sheet's change to the handles, as editedLists says. */
    editMentions({ add = [], remove = [] }: Partial<TagsEdit>) {
      const handles = add.map(asHandle).filter((handle) => handle.length > 1);
      update({ mentionEdits: editedLists(store.get().mentionEdits, { add: handles, remove }) });
    },

    /** Starts over (New chat): the reply under way, if any, is dropped. */
    reset() {
      controller?.abort();
      controller = null;
      chatId = getNewItemId();
      update({ messages: [], isWaiting: false });
    },

    close() {
      controller?.abort();
      update({ isClosed: true, isWaiting: false });
    },
  };
}

// A reply, not one of the user's turns (or no message at all): only a reply has a status.
function isReply(message: ChatMessage | undefined): message is AssistantChatMessage {
  return message?.role === 'assistant';
}

/**
 * The edits after a change: an item taken off goes on the removed list (and off the added one), one
 * added the other way round, in any case. The change comes as `{ add, remove }` (tagsDifference's)
 * and the edits are kept as `{ added, removed }`: two shapes, typed from their owners.
 */
function editedLists({ added, removed }: ListEdits, { add = [], remove = [] }: Partial<TagsEdit>): ListEdits {
  return {
    added: withEdits(added, { added: add, removed: remove }),
    removed: withEdits(removed, { added: remove, removed: add }),
  };
}

// A handle as typed, with its @ and without spaces; a bare @ is none.
function asHandle(text: string): string {
  const handle = text.replace(/\s+/g, '');
  return handle.startsWith('@') ? handle : `@${handle}`;
}
