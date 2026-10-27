import { describe, expect, it, vi } from 'vitest';

import { closeChatSession, getChatSession, openChatSession } from '../src/features/post-chat/chatSession';

const context = { kind: 'draft', text: '', media: { photo: 1, video: 0 }, tags: [], mentions: [] };
const TWEETS = ['one', 'two', 'three'];

// A request whose answers the test settles by hand, in order.
function deferredRequest() {
  const calls: { body: any; signal: AbortSignal; resolve: (v: string[]) => void; reject: (e: unknown) => void }[] = [];
  const request = vi.fn(
    (body: any, { signal }: { signal: AbortSignal }) =>
      new Promise<string[]>((resolve, reject) => calls.push({ body, signal, resolve, reject })),
  );
  return { request, calls };
}

function open() {
  const id = openChatSession({ kind: 'draft' });
  return { id, session: getChatSession(id)! };
}

describe('chatSession', () => {
  it('appends the user turn and a loading reply, then lands the tweets', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const sending = session.send({ label: 'Caption', content: 'Write a caption' }, context, request);
    const { messages, isSending } = session.getState();
    expect(isSending).toBe(true);
    expect(messages).toMatchObject([
      { role: 'user', label: 'Caption', content: 'Write a caption' },
      { role: 'assistant', status: 'loading', tweets: [], label: 'Caption' },
    ]);
    expect(calls[0]!.body).toEqual({ context, messages: [{ role: 'user', content: 'Write a caption' }] });
    calls[0]!.resolve(TWEETS);
    await sending;
    expect(session.getState().isSending).toBe(false);
    expect(session.getState().messages[1]).toMatchObject({ status: 'done', tweets: TWEETS });
  });

  it('sends the answered turns and the new one, but not a failed reply', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    let sending = session.send({ content: 'First' }, context, request);
    calls[0]!.resolve(TWEETS);
    await sending;
    sending = session.send({ content: 'Second' }, context, request);
    calls[1]!.reject({ response: { data: { error: { message: 'Model is busy' } } } });
    await sending;
    expect(session.getState().messages[3]).toMatchObject({ status: 'error', error: 'Model is busy' });
    session.send({ content: 'Third' }, context, request);
    expect(calls[2]!.body.messages).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', tweets: TWEETS },
      { role: 'user', content: 'Second' },
      { role: 'user', content: 'Third' },
    ]);
  });

  it('does nothing on a send while a reply loads', () => {
    const { session } = open();
    const { request } = deferredRequest();
    session.send({ content: 'First' }, context, request);
    session.send({ content: 'Again' }, context, request);
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
    session.retry(context, request);
    expect(request).toHaveBeenCalledTimes(2);
    expect(calls[1]!.body.messages).toEqual([{ role: 'user', content: 'First' }]);
    expect(session.getState().messages).toHaveLength(2);
    expect(session.getState().messages[1]).toMatchObject({ status: 'loading', error: null });
    calls[1]!.resolve(TWEETS);
    await retrying;
    expect(session.getState().messages[1]).toMatchObject({ status: 'done', tweets: TWEETS });
  });

  it('clears the chat on reset', async () => {
    const { session } = open();
    const { request, calls } = deferredRequest();
    const sending = session.send({ content: 'First' }, context, request);
    session.reset();
    expect(calls[0]!.signal.aborted).toBe(true);
    expect(session.getState()).toMatchObject({ messages: [], isSending: false });
    calls[0]!.resolve(TWEETS);
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
    closeChatSession(id);
    expect(getChatSession(id)).toBeUndefined();
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.resolve(TWEETS);
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
    session.setDraft({ text: 'Fog', assets: [] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.getState()).not.toBe(first);
    expect(session.getState().draft).toEqual({ text: 'Fog', assets: [] });
    session.send({ content: 'First' }, context, deferredRequest().request);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    session.reset();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
