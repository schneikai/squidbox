import type { ChatContext, ChatRequest, ChatResponse } from '@squidbox/shared';
import { describe, expect, it, vi } from 'vitest';

import { flushTurns } from './helpers/flushTurns';
import chatSessions, {
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
    const { sending } = await sendNow(session, { label: 'Caption', content: 'Write a caption' }, request);
    const { messages, isSending } = session.getState();
    expect(isSending).toBe(true);
    expect(messages).toMatchObject([
      { role: 'user', label: 'Caption', content: 'Write a caption' },
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
    const sending = session.send(
      { content: 'Write a caption' },
      () => new Promise((resolve) => (read = resolve)),
      request,
    );
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
      { content: 'First' },
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

  it("fails the reply with the error when the context can't be read", async () => {
    const { session } = open();
    const { request } = deferredRequest();
    await session.send({ content: 'First' }, () => Promise.reject(new Error('read the database')), request);
    expect(session.getState().isSending).toBe(false);
    expect(session.getState().messages[1]).toMatchObject({
      status: 'error',
      error: 'read the database',
      errorStatus: null,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('sends a More like this turn with its flag, for the server to put the instruction before it', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    await sendNow(session, { label: 'More like this', content: 'one', moreLikeThis: true }, request);
    expect(session.getState().messages[0]).toMatchObject({ label: 'More like this', content: 'one' });
    expect(calls[0]!.body.messages).toEqual([{ role: 'user', content: 'one', moreLikeThis: true }]);
  });

  it('sends the answered turns and the new one, but not a failed reply', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let { sending } = await sendNow(session, { content: 'First' }, request);
    calls[0]!.resolve(REPLY);
    await sending;
    ({ sending } = await sendNow(session, { content: 'Second' }, request));
    calls[1]!.reject({ response: { data: { error: { message: 'Model is busy' } } } });
    await sending;
    expect(session.getState().messages[3]).toMatchObject({ status: 'error', error: 'Model is busy' });
    await sendNow(session, { content: 'Third' }, request);
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
    for (let turn = 0; turn < 16; turn++) {
      const { sending } = await sendNow(session, { content: `Turn ${turn}` }, request);
      calls[turn]!.resolve(REPLY);
      await sending;
    }
    await sendNow(session, { content: 'Last' }, request);
    const { messages } = calls[16]!.body;
    expect(messages).toHaveLength(29);
    expect(messages[0]).toEqual({ role: 'user', content: 'Turn 2' });
    expect(messages[28]).toEqual({ role: 'user', content: 'Last' });
  });

  it('does nothing on a send while a reply loads', async () => {
    const { session } = open();
    const { request } = deferredRequest();
    expect(session.send({ content: 'First' }, readContext, request)).toBeInstanceOf(Promise);
    expect(session.send({ content: 'Again' }, readContext, request)).toBeNull();
    await flushTurns();
    expect(request).toHaveBeenCalledTimes(1);
    expect(session.getState().messages.filter((m) => m.role === 'assistant' && m.status === 'loading')).toHaveLength(1);
    expect(session.getState().messages).toHaveLength(2);
  });

  it('retries the last user turn once, in place of its failed reply', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const { sending } = await sendNow(session, { content: 'First' }, request);
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
    let { sending } = await sendNow(session, { content: 'Too long' }, request);
    calls[0]!.reject(Object.assign(new Error('Bad Request'), { response: { status: 400 } }));
    await sending;
    expect(session.getState().messages[1]).toMatchObject({ status: 'error', errorStatus: 400 });
    ({ sending } = await sendNow(session, { content: 'Shorter' }, request));
    expect(calls[1]!.body.messages).toEqual([{ role: 'user', content: 'Shorter' }]);
    calls[1]!.resolve(REPLY);
    await sending;
  });

  it('keeps a turn whose reply failed otherwise', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let { sending } = await sendNow(session, { content: 'First' }, request);
    calls[0]!.reject(Object.assign(new Error('Bad Gateway'), { response: { status: 502 } }));
    await sending;
    ({ sending } = await sendNow(session, { content: 'Second' }, request));
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
    expect(session.send({ content: 'First' }, readContext, deferredRequest().request)).toBeNull();
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
    let { sending } = await sendNow(session, { content: 'First' }, request);
    calls[0]!.resolve({ ...REPLY, systemMessage: 'You are a writing assistant.' });
    await sending;
    ({ sending } = await sendNow(session, { content: 'Second' }, request));
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
      const { sending } = await sendNow(session, { content }, request);
      calls[calls.length - 1]!.resolve(REPLY);
      await sending;
    }
    session.reset();
    const { sending } = await sendNow(session, { content: 'Again' }, request);
    calls[2]!.resolve(REPLY);
    await sending;
    expect(calls[1]!.body.chatId).toBe(calls[0]!.body.chatId);
    expect(calls[2]!.body.chatId).not.toBe(calls[0]!.body.chatId);
  });

  it('clears the chat on reset', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const { sending } = await sendNow(session, { content: 'First' }, request);
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
    const { sending } = await sendNow(session, { content: 'First' }, request);
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

  it('applies text through the registered applier, and says whether there is one', () => {
    const { session } = open();
    expect(session.getState().canApply).toBe(false);
    const apply = vi.fn();
    session.setTextApplier(apply);
    expect(session.getState().canApply).toBe(true);
    session.applyText('Fog on the trail');
    expect(apply).toHaveBeenCalledWith('Fog on the trail');
    session.setTextApplier(null);
    expect(session.getState().canApply).toBe(false);
  });

  it('tells subscribers on each change, with a new state', () => {
    const { session } = open();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    const first = session.getState();
    session.send({ content: 'First' }, readContext, deferredRequest().request);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.getState()).not.toBe(first);
    unsubscribe();
    session.reset();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the editor's draft without telling subscribers", () => {
    const { session } = open();
    const listener = vi.fn();
    session.subscribe(listener);
    session.setDraft({ text: 'Fog', assets: [] });
    expect(session.getDraft()).toEqual({ text: 'Fog', assets: [] });
    expect(listener).not.toHaveBeenCalled();
  });
});
