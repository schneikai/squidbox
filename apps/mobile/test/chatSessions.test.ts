import type { ChatContext, ChatRequest, ChatResponse } from '@squidbox/shared';
import { describe, expect, it, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { flushTurns } from './helpers/flushTurns';
import chatSessions, {
  canUseFor,
  type ChatDraftPost,
  type ChatSession,
  type ContextReader,
  type UserTurn,
} from '../src/features/post-chat/chatSessions';
import type chatAsync from '../src/utils/cloud-api/ai/chatAsync';

// The card's tag edits stay in the chat: nothing writes a photo's tags.
const setTags = vi.hoisted(() => vi.fn());
vi.mock('../src/sync/assetsRepository', () => ({ setTags }));

const context: ChatContext = { kind: 'draft', text: '', media: { photo: 1, video: 0 }, tags: [], mentions: [] };
const readContext: ContextReader = async () => context;
const REPLY: ChatResponse = { reply: 'Here are three.', postOptions: ['one', 'two', 'three'] };

// A typed message for the post p1, unless `turn` says otherwise.
const turn = (content: string, changes: Partial<UserTurn> = {}): UserTurn => ({
  content,
  kind: 'message',
  target: 'p1',
  ...changes,
});
const post = (key: string, assets: ChatDraftPost['assets'] = []): ChatDraftPost => ({ key, text: '', assets });

// A request whose answers the test settles by hand, in order.
function deferredRequest() {
  const calls: {
    body: ChatRequest;
    signal: AbortSignal | undefined;
    resolve: (v: ChatResponse) => void;
    reject: (e: unknown) => void;
  }[] = [];
  const request = vi.fn<typeof chatAsync>(
    (body, { signal } = {}) => new Promise((resolve, reject) => calls.push({ body, signal, resolve, reject })),
  );
  return { request, calls };
}

// Sends the turn and lets its context be read, so the request is under way. → `{ sending }`, the
// reply's promise, wrapped so that awaiting this doesn't wait for the reply.
async function sendNow(session: ChatSession, turn: UserTurn, request: typeof chatAsync) {
  const sending = session.send(turn, readContext, request);
  await flushTurns();
  return { sending };
}

function open() {
  const id = chatSessions.open({ kind: 'draft' });
  return { id, session: chatSessions.get(id)! };
}

describe('chatSessions', () => {
  it('appends the user turn and a loading reply, then lands the reply and its options', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const { sending } = await sendNow(
      session,
      turn('Write a caption', { label: 'Post ideas', kind: 'ideas' }),
      request,
    );
    const { messages, isSending } = session.getState();
    expect(isSending).toBe(true);
    expect(messages).toMatchObject([
      { role: 'user', label: 'Post ideas', content: 'Write a caption', kind: 'ideas', target: 'p1' },
      { role: 'assistant', status: 'loading', reply: '', postOptions: [] },
    ]);
    expect(calls[0]!.body).toEqual({
      chatId: expect.any(String),
      context,
      messages: [{ role: 'user', content: 'Write a caption' }],
    });
    calls[0]!.resolve(REPLY);
    await sending;
    expect(session.getState().isSending).toBe(false);
    expect(session.getState().messages[1]).toMatchObject({ status: 'done', ...REPLY });
  });

  it("puts the user's turn and a loading reply in the chat before the context is read, and sends once it is", async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let read: (value: ChatContext) => void = () => {};
    const sending = session.send(turn('Write a caption'), () => new Promise((resolve) => (read = resolve)), request);
    expect(session.getState()).toMatchObject({
      isSending: true,
      messages: [
        { role: 'user', content: 'Write a caption' },
        { role: 'assistant', status: 'loading' },
      ],
    });
    expect(request).not.toHaveBeenCalled();
    read(context);
    await flushTurns();
    expect(calls[0]!.body.context).toBe(context);
    calls[0]!.resolve(REPLY);
    await sending;
  });

  it('aborts the context read on New chat, and sends nothing for it', async () => {
    const { session } = open();
    const { request } = deferredRequest();
    let read: (value: ChatContext) => void = () => {};
    let readSignal: AbortSignal | undefined;
    const sending = session.send(
      turn('First'),
      (signal) => {
        readSignal = signal;
        return new Promise((resolve) => (read = resolve));
      },
      request,
    );
    session.reset();
    expect(readSignal?.aborted).toBe(true);
    read(context);
    await sending;
    expect(request).not.toHaveBeenCalled();
    expect(session.getState().messages).toEqual([]);
  });

  it("is waiting while the context waits for the photos' tags, and not once it is read", async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let read: (value: ChatContext) => void = () => {};
    const sending = session.send(
      turn('First'),
      (_signal, onWait) => {
        onWait();
        return new Promise((resolve) => (read = resolve));
      },
      request,
    );
    expect(session.getState().isWaiting).toBe(true);
    read(context);
    await flushTurns();
    expect(session.getState().isWaiting).toBe(false);
    calls[0]!.resolve(REPLY);
    await sending;
  });

  it('stops waiting at once on New chat, and the dropped read leaves the next one waiting', async () => {
    const { session } = open();
    const { request } = deferredRequest();
    const reads: ((value: ChatContext) => void)[] = [];
    const waitingReader: ContextReader = (_signal, onWait) => {
      onWait();
      return new Promise((resolve) => reads.push(resolve));
    };
    session.send(turn('First'), waitingReader, request);
    session.reset();
    expect(session.getState().isWaiting).toBe(false);
    session.send(turn('Again'), waitingReader, request);
    reads[0]!(context);
    await flushTurns();
    expect(session.getState().isWaiting).toBe(true);
  });

  it("fails the reply with the error when the context can't be read", async () => {
    const { session } = open();
    const { request } = deferredRequest();
    await session.send(turn('First'), () => Promise.reject(new Error('read the database')), request);
    expect(session.getState().isSending).toBe(false);
    expect(session.getState().messages[1]).toMatchObject({
      status: 'error',
      error: 'read the database',
      errorStatus: null,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('sends a More like this turn and a More turn with their flags, for the server to put its instruction before each', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const { sending } = await sendNow(session, turn('one', { label: 'More like this', kind: 'moreLikeThis' }), request);
    expect(session.getState().messages[0]).toMatchObject({ label: 'More like this', content: 'one' });
    calls[0]!.resolve(REPLY);
    await sending;
    await sendNow(session, turn('Write ideas', { label: 'More', kind: 'more' }), request);
    expect(calls[1]!.body.messages).toEqual([
      { role: 'user', content: 'one', moreLikeThis: true },
      { role: 'assistant', ...REPLY },
      { role: 'user', content: 'Write ideas', moreIdeas: true },
    ]);
  });

  it("reads the context of the turn's own post", async () => {
    const { session } = open();
    const { request } = deferredRequest();
    const reader = vi.fn(readContext);
    session.send(turn('Second', { target: 'p2' }), reader, request);
    await flushTurns();
    expect(reader).toHaveBeenCalledWith(expect.any(AbortSignal), expect.any(Function), 'p2');
  });

  it('puts a used option into the post its turn wrote for, and marks it used', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const apply = vi.fn();
    session.setTextApplier(apply);
    session.setDraft({ posts: [post('p1'), post('p2')] });
    const { sending } = await sendNow(session, turn('For the second', { target: 'p2' }), request);
    calls[0]!.resolve(REPLY);
    await sending;
    const reply = session.getState().messages[1]!;
    session.use(reply.id, 1);
    expect(apply).toHaveBeenCalledWith('p2', 'two');
    expect(session.getState().messages[1]).toMatchObject({ usedOption: 1 });
    expect(() => session.use(reply.id, 3)).toThrow();
  });

  it('offers Use only while there is an applier and the post is still there', () => {
    const { session } = open();
    session.setDraft({ posts: [post('p1'), post('p2')] });
    expect(canUseFor(session.getState(), 'p2')).toBe(false);
    session.setTextApplier(vi.fn());
    expect(canUseFor(session.getState(), 'p2')).toBe(true);
    session.setDraft({ posts: [post('p1')] });
    expect(canUseFor(session.getState(), 'p2')).toBe(false);
  });

  it('changes its targets and assets only when a post or an asset comes or goes, not with the text', () => {
    const { session } = open();
    session.setDraft({ posts: [post('p1')] });
    const listener = vi.fn();
    session.subscribe(listener);
    session.setDraft({ posts: [{ ...post('p1'), text: 'Fog' }] });
    expect(listener).not.toHaveBeenCalled();
    session.setDraft({ posts: [post('p1'), post('p2')] });
    expect(session.getState().targets).toEqual(['p1', 'p2']);
    session.setDraft({ posts: [post('p1', [makeAssetRecord({ id: 'ridge' })]), post('p2')] });
    expect(session.getState().assets.map((asset) => asset.id)).toEqual(['ridge']);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('sends the answered turns and the new one, but not a failed reply', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let { sending } = await sendNow(session, turn('First'), request);
    calls[0]!.resolve(REPLY);
    await sending;
    ({ sending } = await sendNow(session, turn('Second'), request));
    calls[1]!.reject({ response: { data: { error: { message: 'Model is busy' } } } });
    await sending;
    expect(session.getState().messages[3]).toMatchObject({ status: 'error', error: 'Model is busy' });
    await sendNow(session, turn('Third'), request);
    expect(calls[2]!.body.messages).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', ...REPLY },
      { role: 'user', content: 'Second' },
      { role: 'user', content: 'Third' },
    ]);
  });

  it('sends only the newest 30 turns, starting with a user turn', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    for (let index = 0; index < 16; index++) {
      const { sending } = await sendNow(session, turn(`Turn ${index}`), request);
      calls[index]!.resolve(REPLY);
      await sending;
    }
    await sendNow(session, turn('Last'), request);
    const { messages } = calls[16]!.body;
    expect(messages).toHaveLength(29);
    expect(messages[0]).toEqual({ role: 'user', content: 'Turn 2' });
    expect(messages[28]).toEqual({ role: 'user', content: 'Last' });
  });

  it('does nothing on a send while a reply loads', async () => {
    const { session } = open();
    const { request } = deferredRequest();
    expect(session.send(turn('First'), readContext, request)).toBeInstanceOf(Promise);
    expect(session.send(turn('Again'), readContext, request)).toBeNull();
    await flushTurns();
    expect(request).toHaveBeenCalledTimes(1);
    expect(session.getState().messages.filter((m) => m.role === 'assistant' && m.status === 'loading')).toHaveLength(1);
    expect(session.getState().messages).toHaveLength(2);
  });

  it('keeps a tray closed at the dropped reply closed, at the message before it', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const first = await sendNow(session, turn('First', { kind: 'ideas', target: 'p1' }), request);
    calls[0]!.resolve(REPLY);
    await first.sending;
    await sendNow(session, turn('Second', { kind: 'ideas', target: 'p2' }), request);
    session.closeIdeas('p1');
    session.cancel();
    const { messages, closedAt } = session.getState();
    expect(closedAt.p1).toBe(messages[1]!.id);
  });

  it('drops the reply under way and its turn on cancel, and a late answer changes nothing', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const first = await sendNow(session, turn('First'), request);
    calls[0]!.resolve(REPLY);
    await first.sending;
    const { sending } = await sendNow(session, turn('Second'), request);
    session.cancel();
    expect(calls[1]!.signal?.aborted).toBe(true);
    expect(session.getState().messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(session.getState().isSending).toBe(false);
    calls[1]!.resolve(REPLY);
    await sending;
    expect(session.getState().messages).toHaveLength(2);
  });

  it('retries the last user turn once, in place of its failed reply', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const { sending } = await sendNow(session, turn('First'), request);
    calls[0]!.reject(new Error('Network Error'));
    await sending;
    const retrying = session.retry(readContext, request);
    await flushTurns();
    expect(session.retry(readContext, request)).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
    expect(calls[1]!.body.messages).toEqual([{ role: 'user', content: 'First' }]);
    expect(session.getState().messages).toHaveLength(2);
    expect(session.getState().messages[1]).toMatchObject({ status: 'loading', error: null });
    calls[1]!.resolve(REPLY);
    await retrying;
    expect(session.getState().messages[1]).toMatchObject({ status: 'done', ...REPLY });
  });

  it('leaves out of later sends a turn the server refused as invalid', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let { sending } = await sendNow(session, turn('Too long'), request);
    calls[0]!.reject(Object.assign(new Error('Bad Request'), { response: { status: 400 } }));
    await sending;
    expect(session.getState().messages[1]).toMatchObject({ status: 'error', errorStatus: 400 });
    ({ sending } = await sendNow(session, turn('Shorter'), request));
    expect(calls[1]!.body.messages).toEqual([{ role: 'user', content: 'Shorter' }]);
    calls[1]!.resolve(REPLY);
    await sending;
  });

  it('keeps a turn whose reply failed otherwise', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let { sending } = await sendNow(session, turn('First'), request);
    calls[0]!.reject(Object.assign(new Error('Bad Gateway'), { response: { status: 502 } }));
    await sending;
    ({ sending } = await sendNow(session, turn('Second'), request));
    expect(calls[1]!.body.messages).toEqual([
      { role: 'user', content: 'First' },
      { role: 'user', content: 'Second' },
    ]);
    calls[1]!.resolve(REPLY);
    await sending;
  });

  it('sends nothing once closed', () => {
    const { id, session } = open();
    chatSessions.close(id);
    expect(session.send(turn('First'), readContext, deferredRequest().request)).toBeNull();
  });

  it("holds the card's tag edits: a removed tag leaves the added ones, an added one the removed", () => {
    const { session } = open();
    expect(session.getState().tagEdits).toEqual({ added: [], removed: [] });
    session.editTags({ remove: ['selfie'] });
    session.editTags({ add: ['campfire', 'Ridge'] });
    expect(session.getState().tagEdits).toEqual({ added: ['campfire', 'Ridge'], removed: ['selfie'] });
    session.editTags({ remove: ['ridge'], add: ['SELFIE'] });
    expect(session.getState().tagEdits).toEqual({ added: ['campfire', 'SELFIE'], removed: ['ridge'] });
    session.reset();
    expect(session.getState().tagEdits.removed).toEqual(['ridge']);
    expect(setTags).not.toHaveBeenCalled();
  });

  it("holds the Mentions sheet's edits, a typed handle with its @", () => {
    const { session } = open();
    session.editMentions({ remove: ['@trailmike'], add: ['corn twee'] });
    expect(session.getState().mentionEdits).toEqual({ added: ['@corntwee'], removed: ['@trailmike'] });
    session.editMentions({ add: ['@TrailMike'] });
    expect(session.getState().mentionEdits).toEqual({ added: ['@corntwee', '@TrailMike'], removed: [] });
  });

  it('adds no handle for a bare @', () => {
    const { session } = open();
    session.editMentions({ add: ['@', ' '] });
    expect(session.getState().mentionEdits.added).toEqual([]);
  });

  it('keeps the system message an ai_admin gets with a reply, and none without', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let { sending } = await sendNow(session, turn('First'), request);
    calls[0]!.resolve({ ...REPLY, systemMessage: 'You are a writing assistant.' });
    await sending;
    ({ sending } = await sendNow(session, turn('Second'), request));
    calls[1]!.resolve(REPLY);
    await sending;
    expect(session.getState().messages.filter((message) => message.role === 'assistant')).toMatchObject([
      { systemMessage: 'You are a writing assistant.' },
      { systemMessage: null },
    ]);
  });

  it('sends one chatId all chat long, and a new one after New chat', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    for (const content of ['First', 'Second']) {
      const { sending } = await sendNow(session, turn(content), request);
      calls[calls.length - 1]!.resolve(REPLY);
      await sending;
    }
    session.reset();
    const { sending } = await sendNow(session, turn('Again'), request);
    calls[2]!.resolve(REPLY);
    await sending;
    expect(calls[1]!.body.chatId).toBe(calls[0]!.body.chatId);
    expect(calls[2]!.body.chatId).not.toBe(calls[0]!.body.chatId);
  });

  it('clears the chat on reset', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const { sending } = await sendNow(session, turn('First'), request);
    session.reset();
    expect(calls[0]!.signal?.aborted).toBe(true);
    expect(session.getState()).toMatchObject({ messages: [], isSending: false });
    calls[0]!.resolve(REPLY);
    await sending;
    expect(session.getState().messages).toEqual([]);
  });

  it('aborts the request on close, and a late answer changes nothing', async () => {
    const { id, session } = open();
    const { request, calls } = deferredRequest();
    const listener = vi.fn();
    session.subscribe(listener);
    const { sending } = await sendNow(session, turn('First'), request);
    chatSessions.close(id);
    const before = session.getState();
    listener.mockClear();
    expect(chatSessions.get(id)).toBeUndefined();
    expect(calls[0]!.signal?.aborted).toBe(true);
    calls[0]!.resolve(REPLY);
    await sending;
    expect(session.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('tells subscribers it closed, so a screen showing it goes', () => {
    const { id, session } = open();
    const listener = vi.fn();
    session.subscribe(listener);
    chatSessions.close(id);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.getState().isClosed).toBe(true);
  });

  it('tells subscribers on each change, with a new state', () => {
    const { session } = open();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    const first = session.getState();
    session.send(turn('First'), readContext, deferredRequest().request);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.getState()).not.toBe(first);
    unsubscribe();
    session.reset();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
