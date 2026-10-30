import { describe, expect, it } from 'vitest';
import { DEFAULT_INSTRUCTIONS, INSTRUCTION_LIMITS } from '@squidbox/shared';
import { chatMessages, fillLines, writingMessages } from '../src/ai/prompts.js';

const persona = {
  aboutYou: '34, outdoor photographer from Oregon, a bit dry.',
  contentTags: ['hiking', 'forest'],
  tone: 'Short and calm. Never salesy.',
  rules: ['Never use hashtags', 'Never name the exact spot'],
};
const favorites = ['First light on the ridge.', 'Fog on the lake.'];
const empty = { aboutYou: '', contentTags: [], tone: '', rules: [] };

const systemOf = (messages: ReturnType<typeof chatMessages>) => messages[0]!.content as string;

const context = {
  kind: 'draft' as const,
  text: 'Fog on the trail',
  media: { photo: 4, video: 1 },
  tags: ['forest', 'fog'],
  mentions: ['@ridgeline.bsky.social'],
};
const transcript = [
  { role: 'user' as const, content: 'Write a caption' },
  { role: 'assistant' as const, reply: 'Here you go.', postOptions: ['one', 'two', 'three'] },
  { role: 'user' as const, content: 'Shorter' },
];

describe('fillLines', () => {
  it('drops a heading above an empty placeholder and keeps the filled lines', () => {
    expect(fillLines('Who: {who}\nRules:\n{rules}\nEnd {missing}', { who: 'Kai', rules: '' })).toBe(
      'Who: Kai\nEnd {missing}',
    );
  });

  it('drops a # heading left with nothing under it, section after section, and keeps one blank line', () => {
    const template = 'Intro\n\n# A\n{a}\n\n# B\nB says:\n{b}\n\n# C\n{c}\n\n# D\nKept';
    expect(fillLines(template, { a: '', b: '', c: '' })).toBe('Intro\n\n# D\nKept');
    expect(fillLines(template, { a: 'one', b: '', c: '' })).toBe('Intro\n\n# A\none\n\n# D\nKept');
    expect(fillLines(template, { a: '', b: '', c: 'three' })).toBe('Intro\n\n# C\nthree\n\n# D\nKept');
    // A hashtag line is not a heading: it stays, and keeps the section above it.
    expect(fillLines('# A\n{a}\n#nofilter\n# B\nKept', { a: '' })).toBe('# A\n#nofilter\n# B\nKept');
  });
});

describe('chatMessages', () => {
  const systemOfChat = (overrides: Partial<Parameters<typeof chatMessages>[0]> = {}) =>
    chatMessages({ instructions: DEFAULT_INSTRUCTIONS, context, transcript, persona, favorites, ...overrides })[0]!
      .content as string;

  it('sends the filled briefing alone as the system message', () => {
    const [system] = chatMessages({ instructions: DEFAULT_INSTRUCTIONS, context, transcript, persona, favorites });
    const content = system!.content as string;
    expect(system!.role).toBe('system');
    expect(content.startsWith('You are a writing assistant for a content creator')).toBe(true);
    expect(content).not.toContain('{"tweets"');
    expect(content).not.toMatch(/\{(aboutYou|tone|contentTags|rules|favorites|media|tags|mentions|caption|count)\}/);
  });

  it('puts the persona and Favorites under their headings, the rules and favorites as lines', () => {
    const content = systemOfChat();
    expect(content).toContain('# The creator\n34, outdoor photographer from Oregon, a bit dry.\nTone: Short and calm.');
    expect(content).toContain('Themes they post about: hiking, forest');
    expect(content).toContain('no exceptions:\n- Never use hashtags\n- Never name the exact spot');
    expect(content).toContain('never copy them):\n- First light on the ridge.\n- Fog on the lake.');
  });

  it('has default App prompts that an edit could save as they are', () => {
    for (const text of Object.values(DEFAULT_INSTRUCTIONS))
      expect(text.length).toBeLessThanOrEqual(INSTRUCTION_LIMITS.text);
  });

  it('keeps a favorite with line breaks on its one line', () => {
    const content = systemOfChat({ favorites: ['Up early.\n\nFog on the lake.'] });
    expect(content).toContain('never copy them):\n- Up early. Fog on the lake.\n');
  });

  it('fills the post: media, tags, handles, the caption as a JSON string, and the count', () => {
    const content = systemOfChat();
    expect(content).toContain('Media: 4 photos and 1 video');
    expect(content).toContain("What's in the photos (from image recognition): forest, fog");
    expect(content).toContain("People they've tagged in posts from the same album: @ridgeline.bsky.social");
    expect(content).toContain('Caption so far: "Fog on the trail"');
    expect(content).toContain('3 options unless they say how many');
  });

  it('says so for an empty caption and no media, and leaves out empty tags and handles', () => {
    const content = systemOfChat({
      context: { ...context, text: '  ', media: { photo: 0, video: 0 }, tags: [], mentions: [] },
    });
    expect(content).toContain('Caption so far: (empty)');
    expect(content).toContain('Media: none yet');
    expect(content).not.toContain("What's in the photos");
    expect(content).not.toContain("People they've tagged");
  });

  it('drops the creator, rules and liked-posts sections, headings included, without a persona or Favorites', () => {
    const content = systemOfChat({ persona: null, favorites: [] });
    expect(content).not.toContain('# The creator');
    expect(content).not.toContain('# Their rules');
    expect(content).not.toContain('# Posts they liked');
    expect(content).toContain("changes the subject.\n\n# The post they're working on\nMedia:");
    expect(content).not.toContain('\n\n\n');
  });

  it('keeps the filled fields of a partly filled persona', () => {
    const content = systemOfChat({ persona: { ...empty, tone: 'Dry.' }, favorites: [] });
    expect(content).toContain('# The creator\nTone: Dry.\n\n# The post');
    expect(content).not.toContain('# Their rules');
  });

  it('follows with the transcript, the past replies as their JSON', () => {
    const [, ...rest] = chatMessages({ instructions: DEFAULT_INSTRUCTIONS, context, transcript, persona, favorites });
    expect(rest).toEqual([
      { role: 'user', content: 'Write a caption' },
      { role: 'assistant', content: '{"reply":"Here you go.","postOptions":["one","two","three"]}' },
      { role: 'user', content: 'Shorter' },
    ]);
  });

  it("puts the user's More like this instruction before a More like this turn's option", () => {
    const instructions = { ...DEFAULT_INSTRUCTIONS, moreLikeThis: 'Again, please.' };
    const turns = [...transcript, { role: 'user' as const, content: 'one', moreLikeThis: true }];
    const messages = chatMessages({ instructions, context, transcript: turns, persona, favorites });
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Again, please.\n\none' });
  });

  it("uses the user's own Writing text as the briefing", () => {
    const content = systemOfChat({ instructions: { ...DEFAULT_INSTRUCTIONS, writing: 'Be brief. {caption}' } });
    expect(content).toBe('Be brief. "Fog on the trail"');
  });
});

describe('writingMessages (the Compare)', () => {
  it("follows with the model's earlier posts as its answers, each asking for different ones", () => {
    const messages = writingMessages('Write 3 posts', [['a', 'b'], ['c']]);
    expect(messages.slice(1)).toEqual([
      { role: 'user', content: 'Write 3 posts' },
      { role: 'assistant', content: '{"posts":["a","b"]}' },
      { role: 'user', content: 'Write different ones.' },
      { role: 'assistant', content: '{"posts":["c"]}' },
      { role: 'user', content: 'Write different ones.' },
    ]);
  });

  it('sends the prompt as the user, after a system line on the format only', () => {
    expect(writingMessages('Write 3 posts about a sunrise hike')).toEqual([
      {
        role: 'system',
        content:
          'Answer in JSON, with only the posts the prompt asks for. Each item is one finished post, with no intro, notes or quotes around it.',
      },
      { role: 'user', content: 'Write 3 posts about a sunrise hike' },
    ]);
  });
});
