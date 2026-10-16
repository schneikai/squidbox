import { describe, it, expect, vi, beforeEach } from 'vitest';

const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
  },
}));

const { CHAT_STORAGE_KEY } = await import('../src/features/ai-suggestions/aiSuggestionsStorage');
const { default: readChatHistory } = await import('../src/features/ai-suggestions/readChatHistory');
const { default: saveChatHistory } = await import('../src/features/ai-suggestions/saveChatHistory');

function store(value: unknown) {
  storage.set(CHAT_STORAGE_KEY, JSON.stringify(value));
}

describe('readChatHistory', () => {
  beforeEach(() => storage.clear());

  it('returns an empty chat with no style reference drawn when nothing is stored', async () => {
    expect(await readChatHistory()).toEqual({ messages: [], referencePosts: null });
  });

  it('keeps the style-reference sample and the opt-out across a reload', async () => {
    const messages = [
      { role: 'user', content: 'Create some caption ideas' },
      { role: 'assistant', variations: ['One', 'Two', 'Three'] },
    ];
    await saveChatHistory(messages, ['An old post', 'Another old post']);
    expect(await readChatHistory()).toEqual({ messages, referencePosts: ['An old post', 'Another old post'] });

    await saveChatHistory(messages, []);
    expect(await readChatHistory()).toEqual({ messages, referencePosts: [] });
  });

  it('reads a chat stored as a plain message list, with no style reference drawn yet', async () => {
    store([
      { role: 'user', content: 'Create some caption ideas' },
      { role: 'assistant', content: '["One","Two"]' },
    ]);
    expect(await readChatHistory()).toEqual({
      messages: [
        { role: 'user', content: 'Create some caption ideas' },
        { role: 'assistant', variations: ['One', 'Two'] },
      ],
      referencePosts: null,
    });
  });

  it('keeps an old reply that is not a JSON array of strings as one variation of its text', async () => {
    store([
      { role: 'user', content: 'Create some caption ideas' },
      { role: 'assistant', content: "['Morning coffee vibes']" },
      { role: 'user', content: 'Something else' },
      { role: 'assistant', content: 'Just a plain caption' },
      { role: 'user', content: 'Again' },
      { role: 'assistant', content: '[{"text":"One"}]' },
    ]);
    const { messages } = await readChatHistory();
    expect(messages).toEqual([
      { role: 'user', content: 'Create some caption ideas' },
      { role: 'assistant', variations: ['Morning coffee vibes'] },
      { role: 'user', content: 'Something else' },
      { role: 'assistant', variations: ['Just a plain caption'] },
      { role: 'user', content: 'Again' },
      { role: 'assistant', variations: ['{"text":"One"}'] },
    ]);
  });

  it('drops empty and whitespace variations, and replies with no text left', async () => {
    store({
      messages: [
        { role: 'user', content: 'Create some caption ideas' },
        { role: 'assistant', variations: [' One ', '', '   ', 'Two'] },
        { role: 'assistant', content: '["", "  "]' },
        { role: 'assistant', content: '[]' },
        { role: 'assistant', variations: [' '] },
      ],
      referencePosts: ['An old post'],
    });
    expect(await readChatHistory()).toEqual({
      messages: [
        { role: 'user', content: 'Create some caption ideas' },
        { role: 'assistant', variations: ['One', 'Two'] },
      ],
      referencePosts: ['An old post'],
    });
  });
});
