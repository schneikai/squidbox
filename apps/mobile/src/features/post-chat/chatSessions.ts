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
import sameOrder from '@/lib/sameOrder';
import type chatAsync from '@/utils/cloud-api/ai/chatAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import errorResponse from '@/utils/cloud-api/errorResponse';
import getNewItemId from '@/utils/getNewItemId';
import type { TagsEdit } from '@/utils/tagsDifference';

/**
 * What a turn is: `ideas`, a post's own ideas prompt (Post ideas, Repost ideas), and `prompt`, a
 * prompt button, both tapped on the tray (each starts the tray's run, ideasRun); `more`, More after
 * a set of ideas (the run's prompt again, which the server puts its More instruction before);
 * `moreLikeThis`, More like this on an option (which it puts its More like this instruction before);
 * `message`, what the chat's composer sends (typed, or a prompt button's prompt put there).
 */
export type TurnKind = 'ideas' | 'prompt' | 'more' | 'moreLikeThis' | 'message';

/**
 * The user's turn as `send` takes it: `content`, what is sent; `kind`; `target`, the key of the post
 * it writes for (one of the chat's `targets`); and `label`, a prompt button's or the ideas' name over
 * it in the bubble, or none for a typed message.
 */
export type UserTurn = { content: string; kind: TurnKind; target: string; label?: string | null };

// What waits in the composer: a prompt button's turn (its name and prompt), or what was typed.
export type ChatSeed = Pick<UserTurn, 'label' | 'content'>;

export type UserChatMessage = Required<UserTurn> & { id: string; role: 'user' };

/**
 * A reply: `reply`, what the assistant says; `postOptions`, the options for the post, when the user
 * asked for posts; `systemMessage`, what the model was told, for an ai_admin, else null;
 * `errorStatus`, the failed request's HTTP status, if any; `usedOption`, the index of the option Use
 * put into the post, if any.
 */
export type AssistantChatMessage = ChatReply & {
  id: string;
  role: 'assistant';
  status: 'loading' | 'done' | 'error';
  systemMessage: Exclude<ChatResponse['systemMessage'], undefined> | null;
  error: string | null;
  errorStatus: number | null;
  usedOption: number | null;
};

// A message narrows by its `role`: only a reply has a status.
export type ChatMessage = UserChatMessage | AssistantChatMessage;

type ChatSessionState = {
  kind: ChatSubjectKind;
  messages: ChatMessage[];
  // The keys of the posts the chat writes for, in the thread's order (the draft's); and the post being
  // edited, which the composer writes for (null before the screen says).
  targets: string[];
  activeTarget: string | null;
  // The assets of all the posts, each once, in order: changes only when one is added or removed.
  assets: AssetRecord[];
  isSending: boolean;
  // While the turn's context waits for the photos' tags.
  isWaiting: boolean;
  canApply: boolean;
  tagEdits: ListEdits;
  mentionEdits: ListEdits;
  // By post, where Back on its tray closed the run of ideas it showed: the id of the chat's last
  // message then (ideasRun shows only a run started after it).
  closedAt: Partial<Record<string, string>>;
  // Once the chat was closed: a screen showing it goes.
  isClosed: boolean;
};

// One post of the chat's draft: its key (a target), its text and its assets (`asset` rows).
export type ChatDraftPost = { key: string; text: string; assets: AssetRecord[] };

type ChatDraft = { posts: ChatDraftPost[] };

// How Use puts an option into a post: the post's key and the text.
type TextApplier = (target: string, text: string) => void;

type ChatRequester = typeof chatAsync;

export type ChatSession = ReturnType<typeof createSession>;

/**
 * What the chat is about, read when the turn for the post `target` goes: it may wait for the photos'
 * tags, and calls `onWait()` when it does (the chat is `isWaiting` until the read ends). `signal`
 * aborts once the turn is dropped (New chat, or the chat closed); what it resolves to then is
 * ignored.
 */
export type ContextReader = (signal: AbortSignal, onWait: () => void, target: string) => Promise<ChatContext>;

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
      return [
        {
          role: 'user',
          content: message.content,
          ...(message.kind === 'moreLikeThis' && { moreLikeThis: true }),
          ...(message.kind === 'more' && { moreIdeas: true }),
        },
      ];
    }
    return message.status === 'done'
      ? [{ role: 'assistant', reply: message.reply, postOptions: message.postOptions }]
      : [];
  });
  const newest = turns.slice(-CHAT_LIMITS.messages);
  return newest[0]?.role === 'assistant' ? newest.slice(1) : newest;
}

/**
 * One chat about a post and its thread: `getState()` → `{ kind, messages, targets, activeTarget,
 * assets, isSending, isWaiting, canApply, tagEdits, mentionEdits, closedAt, isClosed }`, a new object on each change, which
 * `subscribe(listener)` tells. A message is the user's (UserChatMessage, for one post, its `target`)
 * or a reply (AssistantChatMessage). `isSending` while a reply loads; `isWaiting` while its context
 * waits for the photos' tags. `isClosed` once the chat was closed (its last change). `send` and
 * `retry` put the turn in the chat at once and read the context when they go. The posts' texts and
 * assets (`getDraft()`) change with every keystroke, so they are read when needed, not told; only a
 * post added or removed changes `targets`, and an asset added or removed `assets`. `tagEdits` is what the chat card changed in the post's tags (postTags): kept
 * here only, while the editor is open, never on the photos. `mentionEdits` is the same for the
 * handles it may mention (chatMentions), never on the posts.
 */
function createSession(kind: ChatSubjectKind) {
  const store = createStore<ChatSessionState>({
    kind,
    messages: [],
    targets: [],
    activeTarget: null,
    assets: [],
    isSending: false,
    isWaiting: false,
    canApply: false,
    tagEdits: NO_EDITS,
    mentionEdits: NO_EDITS,
    closedAt: {},
    isClosed: false,
  });
  let draft: ChatDraft = { posts: [] };
  let applier: TextApplier | null = null;
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

  // Asks for the reply `replyId` to the messages before it, about the context `readContext` reads for
  // the post `target`, and lands the answer (or the failure to read the context) on it.
  async function requestReply(replyId: string, target: string, readContext: ContextReader, request: ChatRequester) {
    controller = new AbortController();
    const { signal } = controller;
    try {
      const onWait = () => {
        if (!signal.aborted) update({ isWaiting: true });
      };
      const context = await readContext(signal, onWait, target).finally(() => {
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

    /** The posts' texts and assets (`asset` rows) as they are now. */
    getDraft: () => draft,

    /**
     * The posts as they are now; `targets` and `assets` change only when a post or an asset was added
     * or removed.
     */
    setDraft(next: ChatDraft) {
      draft = next;
      const state = store.get();
      const keys = next.posts.map((post) => post.key);
      const assets = [...new Map(next.posts.flatMap((post) => post.assets).map((asset) => [asset.id, asset])).values()];
      const changes: Partial<ChatSessionState> = {
        ...(!sameOrder(keys, state.targets) && { targets: keys }),
        ...(!sameOrder(
          assets.map((asset) => asset.id),
          state.assets.map((asset) => asset.id),
        ) && { assets }),
      };
      if (Object.keys(changes).length > 0) update(changes);
    },

    /** The post being edited, which the composer writes for. */
    setActiveTarget(target: string) {
      if (store.get().activeTarget !== target) update({ activeTarget: target });
    },

    /** How Use puts an option into a post (the editor's), or null: the options are copied instead. */
    setTextApplier(fn: TextApplier | null) {
      applier = fn;
      update({ canApply: Boolean(fn) });
    },

    /**
     * Use on the option `index` of the reply `replyId`: puts it into the post its turn wrote for, and
     * marks it used. Throws for a reply or option that isn't there.
     */
    use(replyId: string, index: number) {
      const { messages } = store.get();
      const at = messages.findIndex((message) => message.id === replyId);
      const reply = messages[at];
      const turn = messages[at - 1];
      const text = isReply(reply) ? reply.postOptions[index] : undefined;
      if (text === undefined || turn?.role !== 'user') throw new Error(`No option ${index} of the reply ${replyId}`);
      applier?.(turn.target, text);
      replaceMessage(replyId, { usedOption: index });
    },

    /**
     * Puts the user's turn and its loading reply in the chat, then sends it about the context
     * `readContext(signal)` resolves to (chatContextSchema) through `request(body, { signal })`, which
     * resolves to the reply, `{ reply, postOptions }`. → the reply's promise, or null when nothing was
     * sent (a reply is loading, or the chat was closed).
     */
    send({ label = null, ...turn }: UserTurn, readContext: ContextReader, request: ChatRequester) {
      const { isSending, isClosed } = store.get();
      if (isSending || isClosed) return null;
      const userMessage: UserChatMessage = { id: `m${++lastMessageId}`, role: 'user', label, ...turn };
      const reply: AssistantChatMessage = {
        id: `m${++lastMessageId}`,
        role: 'assistant',
        status: 'loading',
        reply: '',
        postOptions: [],
        systemMessage: null,
        error: null,
        errorStatus: null,
        usedOption: null,
      };
      update({ messages: [...store.get().messages, userMessage, reply] });
      return requestReply(reply.id, userMessage.target, readContext, request);
    },

    /** Asks again for the last reply, after it failed. → as `send`. */
    retry(readContext: ContextReader, request: ChatRequester) {
      const { messages, isSending, isClosed } = store.get();
      const last = messages[messages.length - 1];
      const turn = messages[messages.length - 2];
      if (isSending || isClosed || !isReply(last) || last.status !== 'error' || turn?.role !== 'user') return null;
      replaceMessage(last.id, { status: 'loading', error: null, errorStatus: null });
      return requestReply(last.id, turn.target, readContext, request);
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

    /** Back on the tray of the post `target`: its run of ideas so far is closed. */
    closeIdeas(target: string) {
      const { messages, closedAt } = store.get();
      const last = messages[messages.length - 1];
      if (last) update({ closedAt: { ...closedAt, [target]: last.id } });
    },

    /** Starts over (New chat): the reply under way, if any, is dropped. */
    reset() {
      controller?.abort();
      controller = null;
      chatId = getNewItemId();
      update({ messages: [], closedAt: {}, isWaiting: false });
    },

    close() {
      controller?.abort();
      update({ isClosed: true, isWaiting: false });
    },
  };
}

// A reply, not one of the user's turns (or no message at all): only a reply has a status.
export function isReply(message: ChatMessage | undefined): message is AssistantChatMessage {
  return message?.role === 'assistant';
}

/** Whether Use is offered for a turn written for `target`: the chat has an applier and the post is still there. */
export function canUseFor({ canApply, targets }: Pick<ChatSessionState, 'canApply' | 'targets'>, target: string) {
  return canApply && targets.includes(target);
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
