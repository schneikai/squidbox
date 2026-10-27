import { describe, expect, it, vi } from 'vitest';

import chatSessions from '../src/features/post-chat/chatSessions';

const context = { kind: 'draft', text: '', media: { photo: 1, video: 0 }, tags: [], mentions: [] };
const REPLY = { reply: 'Here are three.', postOptions: ['one', 'two', 'three'] };
type Reply = typeof REPLY;

// A request whose answers the test settles by hand, in order.
function deferredRequest() {
  const calls: { body: any; signal: AbortSignal; resolve: (v: Reply) => void; reject: (e: unknown) => void }[] = [];
  const request = vi.fn(
    (body: any, { signal }: { signal: AbortSignal }) =>
      new Promise<Reply>((resolve, reject) => calls.push({ body, signal, resolve, reject })),
  );
  return { request, calls };
}

function open() {
  const id = chatSessions.open({ kind: 'draft' });
  return { id, session: chatSessions.get(id)! };
}

describe('chatSessions', () => {
  it('appends the user turn and a loading reply, then lands the reply and its options', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const sending = session.send({ label: 'Caption', content: 'Write a caption' }, context, request);
    const { messages, isSending } = session.getState();
    expect(isSending).toBe(true);
    expect(messages).toMatchObject([
      { role: 'user', label: 'Caption', content: 'Write a caption' },
      { role: 'assistant', status: 'loading', reply: '', postOptions: [] },
    ]);
    expect(calls[0]!.body).toEqual({ context, messages: [{ role: 'user', content: 'Write a caption' }] });
    calls[0]!.resolve(REPLY);
    await sending;
    expect(session.getState().isSending).toBe(false);
    expect(session.getState().messages[1]).toMatchObject({ status: 'done', ...REPLY });
  });

  it('sends the answered turns and the new one, but not a failed reply', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let sending = session.send({ content: 'First' }, context, request);
    calls[0]!.resolve(REPLY);
    await sending;
    sending = session.send({ content: 'Second' }, context, request);
    calls[1]!.reject({ response: { data: { error: { message: 'Model is busy' } } } });
    await sending;
    expect(session.getState().messages[3]).toMatchObject({ status: 'error', error: 'Model is busy' });
    session.send({ content: 'Third' }, context, request);
    expect(calls[2]!.body.messages).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', ...REPLY },
      { role: 'user', content: 'Second' },
      { role: 'user', content: 'Third' },
    ]);
  });

  it('sends only the newest 30 turns', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    for (let turn = 0; turn < 16; turn++) {
      const sending = session.send({ content: `Turn ${turn}` }, context, request);
      calls[turn]!.resolve(REPLY);
      await sending;
    }
    session.send({ content: 'Last' }, context, request);
    const { messages } = calls[16]!.body;
    expect(messages).toHaveLength(30);
    expect(messages[0]).toEqual({ role: 'assistant', ...REPLY });
    expect(messages[29]).toEqual({ role: 'user', content: 'Last' });
  });

  it('does nothing on a send while a reply loads', () => {
    const { session } = open();
    const { request } = deferredRequest();
    expect(session.send({ content: 'First' }, context, request)).toBeInstanceOf(Promise);
    expect(session.send({ content: 'Again' }, context, request)).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    expect(session.getState().messages.filter((m: any) => m.status === 'loading')).toHaveLength(1);
    expect(session.getState().messages).toHaveLength(2);
  });

  it('retries the last user turn once, in place of its failed reply', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const sending = session.send({ content: 'First' }, context, request);
    calls[0]!.reject(new Error('Network Error'));
    await sending;
    const retrying = session.retry(context, request);
    expect(session.retry(context, request)).toBeNull();
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
    let sending = session.send({ content: 'Too long' }, context, request);
    calls[0]!.reject(Object.assign(new Error('Bad Request'), { response: { status: 400 } }));
    await sending;
    expect(session.getState().messages[1]).toMatchObject({ status: 'error', errorStatus: 400 });
    sending = session.send({ content: 'Shorter' }, context, request);
    expect(calls[1]!.body.messages).toEqual([{ role: 'user', content: 'Shorter' }]);
    calls[1]!.resolve(REPLY);
    await sending;
  });

  it('keeps a turn whose reply failed otherwise', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let sending = session.send({ content: 'First' }, context, request);
    calls[0]!.reject(Object.assign(new Error('Bad Gateway'), { response: { status: 502 } }));
    await sending;
    sending = session.send({ content: 'Second' }, context, request);
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
    expect(session.send({ content: 'First' }, context, deferredRequest().request)).toBeNull();
  });

  it('clears the chat on reset', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const sending = session.send({ content: 'First' }, context, request);
    session.reset();
    expect(calls[0]!.signal.aborted).toBe(true);
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
    const sending = session.send({ content: 'First' }, context, request);
    const before = session.getState();
    listener.mockClear();
    chatSessions.close(id);
    expect(chatSessions.get(id)).toBeUndefined();
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.resolve(REPLY);
    await sending;
    expect(session.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
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
    session.send({ content: 'First' }, context, deferredRequest().request);
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
