import { describe, expect, it } from 'vitest';
import { DEFAULT_INSTRUCTIONS } from '@squidbox/shared';
import { chatMessages, fillLines, writingFormatText, writingMessages } from '../src/ai/prompts.js';

const WRITING_FORMAT = writingFormatText(DEFAULT_INSTRUCTIONS.writingFormat);

const persona = {
  aboutYou: '34, outdoor photographer from Oregon, a bit dry.',
  contentTags: ['hiking', 'forest'],
  tone: 'Short and calm. Never salesy.',
  rules: ['Never use hashtags', 'Never name the exact spot'],
};
const favorites = ['First light on the ridge.', 'Fog on the lake.'];
const empty = { aboutYou: '', contentTags: [], tone: '', rules: [] };

const systemOf = (messages: ReturnType<typeof writingMessages>) => messages[0]!.content as string;

describe('writingMessages with a persona', () => {
  it('writes every field of a full persona and the favorites into the system message', () => {
    const system = systemOf(
      writingMessages({ instructions: DEFAULT_INSTRUCTIONS, prompt: 'Write', persona, favorites }),
    );
    expect(system).toContain('About the creator: 34, outdoor photographer from Oregon, a bit dry.');
    expect(system).toContain('Their content: hiking, forest');
    expect(system).toContain('Their tone: Short and calm. Never salesy.');
    expect(system).not.toContain('emoji');
    expect(system).toContain('- Never use hashtags\n- Never name the exact spot');
    expect(system).toContain(
      'Example posts they wrote. Write like these:\n---\nFirst light on the ridge.\n---\nFog on the lake.\n---',
    );
    // In the screen's order: About you, Tone, Your content, Rules.
    const order = ['About the creator', 'Their tone', 'Their content', 'Rules', 'Example posts'];
    const at = order.map((text) => system.indexOf(text));
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('sends the favorites without a saved persona', () => {
    const system = systemOf(
      writingMessages({ instructions: DEFAULT_INSTRUCTIONS, prompt: 'Write', persona: null, favorites }),
    );
    expect(system).toContain('Write like these:\n---\nFirst light on the ridge.');
    expect(system).not.toContain('emoji');
  });

  it('leaves out the empty fields of a partly filled one', () => {
    const system = systemOf(
      writingMessages({
        instructions: DEFAULT_INSTRUCTIONS,
        prompt: 'Write',
        persona: { ...empty, tone: 'Sweet.' },
        favorites: [],
      }),
    );
    expect(system).toContain('Their tone: Sweet.');
    expect(system).not.toContain('About the creator');
    expect(system).not.toContain('Their content');
    expect(system).not.toContain('Rules');
    expect(system).not.toContain('Example posts');
  });

  it("starts with the user's writing instructions and ends with the fixed reply format", () => {
    const system = systemOf(
      writingMessages({ instructions: DEFAULT_INSTRUCTIONS, prompt: 'Write', persona, favorites }),
    );
    expect(system.startsWith(DEFAULT_INSTRUCTIONS.writing)).toBe(true);
    expect(system.endsWith(WRITING_FORMAT)).toBe(true);
    const mine = 'Write like a ranger. Reply in prose, one paragraph.';
    const changed = systemOf(
      writingMessages({
        instructions: { ...DEFAULT_INSTRUCTIONS, writing: mine },
        prompt: 'Write',
        persona,
        favorites,
      }),
    );
    expect(changed.startsWith(mine)).toBe(true);
    expect(changed).not.toContain(DEFAULT_INSTRUCTIONS.writing);
    expect(changed).toContain('About the creator');
    expect(changed.endsWith(WRITING_FORMAT)).toBe(true);
  });

  it('has no persona text without one or favorites', () => {
    expect(
      systemOf(writingMessages({ instructions: DEFAULT_INSTRUCTIONS, prompt: 'Write', persona: null, favorites: [] })),
    ).toBe(`${DEFAULT_INSTRUCTIONS.writing}\n\n${WRITING_FORMAT}`);
  });
});

describe('the app prompts, edited', () => {
  it("frames a full persona exactly as the app's fixed text did", () => {
    const system = systemOf(
      writingMessages({ instructions: DEFAULT_INSTRUCTIONS, prompt: 'Write', persona, favorites }),
    );
    expect(system).toBe(
      [
        DEFAULT_INSTRUCTIONS.writing,
        [
          'About the creator: 34, outdoor photographer from Oregon, a bit dry.',
          'Their tone: Short and calm. Never salesy.',
          'Their content: hiking, forest',
          'Rules, always follow them:\n- Never use hashtags\n- Never name the exact spot',
          'Example posts they wrote. Write like these:\n---\nFirst light on the ridge.\n---\nFog on the lake.\n---',
        ].join('\n'),
        'Reply with exactly 3 posts, each only the finished post text, no numbering, quotes or commentary, ' +
          'as a JSON object: {"tweets": [...]}.',
      ].join('\n\n'),
    );
  });

  it("uses the user's persona framing and reply format, dropping an empty line and its heading", () => {
    const instructions = {
      ...DEFAULT_INSTRUCTIONS,
      personaFraming: 'Who: {aboutYou}\nMust do:\n{rules}\nVoice: {tone} ({unknown})',
      writingFormat: 'Give {count} posts as {"tweets": [...]}',
    };
    const system = systemOf(
      writingMessages({
        instructions,
        prompt: 'Write',
        persona: { ...empty, aboutYou: 'Hiker.', tone: 'Dry.' },
        favorites: [],
      }),
    );
    expect(system).toBe(
      `${DEFAULT_INSTRUCTIONS.writing}\n\nWho: Hiker.\nVoice: Dry. ({unknown})\n\nGive 3 posts as {"tweets": [...]}`,
    );
  });
});

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
  });
});

describe('chatMessages', () => {
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
  const systemOfChat = (overrides: Partial<Parameters<typeof chatMessages>[0]> = {}) =>
    chatMessages({ instructions: DEFAULT_INSTRUCTIONS, context, transcript, persona, favorites, ...overrides })[0]!
      .content as string;

  it('sends the filled briefing alone as the system message', () => {
    const [system] = chatMessages({ instructions: DEFAULT_INSTRUCTIONS, context, transcript, persona, favorites });
    const content = system!.content as string;
    expect(system!.role).toBe('system');
    expect(content.startsWith('You are the writing assistant inside Squidbox')).toBe(true);
    expect(content).not.toContain(DEFAULT_INSTRUCTIONS.writing);
    expect(content).not.toContain('About the creator:');
    expect(content).not.toContain(WRITING_FORMAT);
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

  it("uses the user's own briefing", () => {
    const content = systemOfChat({ instructions: { ...DEFAULT_INSTRUCTIONS, chatContext: 'Be brief. {caption}' } });
    expect(content).toBe('Be brief. "Fog on the trail"');
  });
});

describe('writingMessages', () => {
  it('still ends with the reply format', () => {
    const [system] = writingMessages({
      prompt: 'Write',
      instructions: DEFAULT_INSTRUCTIONS,
      persona: null,
      favorites: [],
    });
    expect((system!.content as string).endsWith(WRITING_FORMAT)).toBe(true);
  });
});
