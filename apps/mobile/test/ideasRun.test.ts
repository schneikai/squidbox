import { describe, expect, it } from 'vitest';

import type {
  AssistantChatMessage,
  ChatMessage,
  TurnKind,
  UserChatMessage,
} from '../src/features/post-chat/chatSessions';
import ideasRun from '../src/features/post-ideas/ideasRun';

let lastId = 0;
const user = (kind: TurnKind, target = 'p1', content = `${kind} prompt`): UserChatMessage => ({
  id: `m${++lastId}`,
  role: 'user',
  kind,
  target,
  content,
  label: kind === 'ideas' ? 'Post ideas' : kind,
});
const reply = (options: string[], changes: Partial<AssistantChatMessage> = {}): AssistantChatMessage => ({
  id: `m${++lastId}`,
  role: 'assistant',
  status: 'done',
  reply: '',
  postOptions: options,
  systemMessage: null,
  error: null,
  errorStatus: null,
  usedOption: null,
  ...changes,
});
const texts = (messages: ChatMessage[], target = 'p1', closedAt: string | null = null) =>
  ideasRun(messages, target, closedAt)?.items.map((item) => item.text);

describe('ideasRun', () => {
  it("starts at the post's last ideas or prompt button turn from the tray", () => {
    const messages = [user('ideas'), reply(['a']), user('prompt', 'p1', 'Follow-up'), reply(['b'])];
    expect(ideasRun(messages, 'p1', null)).toMatchObject({
      name: 'prompt',
      prompt: 'Follow-up',
      isOwnIdeas: false,
      items: [{ text: 'b', index: 0 }],
    });
  });

  it("adds More and the chat's turns for the post to the run, and they never start one", () => {
    const messages = [
      user('ideas'),
      reply(['a', 'b']),
      user('more'),
      reply(['c']),
      user('message'),
      reply([], { reply: 'Sure, here is one thought.' }),
      user('moreLikeThis'),
      reply(['d']),
    ];
    expect(ideasRun(messages, 'p1', null)).toMatchObject({ name: 'Post ideas', isOwnIdeas: true });
    expect(texts(messages)).toEqual(['a', 'b', 'c', 'Sure, here is one thought.', 'd']);
    expect(ideasRun([user('message'), reply(['x'])], 'p1', null)).toBeNull();
  });

  it("leaves out another post's turns", () => {
    const messages = [user('ideas'), reply(['a']), user('prompt', 'p2'), reply(['b']), user('more'), reply(['c'])];
    expect(texts(messages)).toEqual(['a', 'c']);
    expect(texts(messages, 'p2')).toEqual(['b']);
  });

  it('hides a run closed by Back until a new one starts', () => {
    const messages = [user('prompt'), reply(['a'])];
    const closedAt = messages[1]!.id;
    expect(ideasRun(messages, 'p1', closedAt)).toBeNull();
    expect(texts([...messages, user('more'), reply(['b'])], 'p1', closedAt)).toBeUndefined();
    expect(texts([...messages, user('prompt'), reply(['c'])], 'p1', closedAt)).toEqual(['c']);
    expect(texts([user('prompt'), reply(['d'])], 'p1', 'gone')).toEqual(['d']);
  });

  it('is writing while its last reply is written', () => {
    const messages = [user('ideas'), reply(['a']), user('more'), reply([], { status: 'loading' })];
    expect(ideasRun(messages, 'p1', null)).toMatchObject({ isWriting: true, items: [{ text: 'a' }] });
  });

  it("is its last reply's failure, with Retry only when that is the chat's last reply", () => {
    const failed = reply([], { status: 'error', error: 'Model is busy' });
    const messages = [user('ideas'), reply(['a']), user('more'), failed];
    expect(ideasRun(messages, 'p1', null)!.error).toEqual({ message: 'Model is busy', canRetry: true });
    expect(ideasRun([...messages, user('prompt', 'p2'), reply(['b'])], 'p1', null)!.error).toEqual({
      message: 'Model is busy',
      canRetry: false,
    });
  });

  it("offers Back on a prompt button's run, and on the post's own ideas only once failed past Retry", () => {
    const failed = reply([], { status: 'error', error: 'Model is busy' });
    expect(ideasRun([user('prompt'), reply(['a'])], 'p1', null)!.canClose).toBe(true);
    expect(ideasRun([user('ideas'), failed], 'p1', null)!.canClose).toBe(false);
    expect(ideasRun([user('ideas'), failed, user('prompt', 'p2'), reply(['b'])], 'p1', null)!.canClose).toBe(true);
  });
});
