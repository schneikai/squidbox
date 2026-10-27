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
});

describe('chatMessages', () => {
  const context = {
    kind: 'draft' as const,
    text: 'Fog on the trail',
    media: { photo: 2, video: 1 },
    tags: ['forest', 'fog'],
    mentions: ['@ridgeline.bsky.social'],
  };
  const transcript = [
    { role: 'user' as const, content: 'Write a caption' },
    { role: 'assistant' as const, tweets: ['one', 'two', 'three'] },
    { role: 'user' as const, content: 'Shorter' },
  ];

  it('puts the instructions, persona, chat context and reply format in the system message, in order', () => {
    const [system] = chatMessages({ instructions: DEFAULT_INSTRUCTIONS, context, transcript, persona, favorites });
    const content = system!.content as string;
    expect(system!.role).toBe('system');
    const order = [
      DEFAULT_INSTRUCTIONS.writing,
      'About the creator',
      'The user is working on a new post in their app',
      WRITING_FORMAT,
    ];
    const at = order.map((text) => content.indexOf(text));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(content.endsWith(WRITING_FORMAT)).toBe(true);
    expect(content).toContain('In it: 2 photos, 1 video.');
    expect(content).toContain('What the photos show, as tags: forest, fog.');
    expect(content).toContain('Handles they mention in posts like this one: @ridgeline.bsky.social.');
    expect(content).toContain("The post's text so far: Fog on the trail");
  });

  it('leaves out a context line whose value is empty', () => {
    const [system] = chatMessages({
      instructions: DEFAULT_INSTRUCTIONS,
      context: { ...context, text: '', media: { photo: 1, video: 0 }, tags: [], mentions: [] },
      transcript,
      persona: null,
      favorites: [],
    });
    const content = system!.content as string;
    expect(content).toContain('In it: 1 photo.');
    expect(content).not.toContain('as tags');
    expect(content).not.toContain('Handles');
    expect(content).not.toContain("The post's text so far:");
    expect(content).toContain('Reply with options for the post.');
  });

  it('follows with the transcript, the past replies as their JSON', () => {
    const [, ...rest] = chatMessages({ instructions: DEFAULT_INSTRUCTIONS, context, transcript, persona, favorites });
    expect(rest).toEqual([
      { role: 'user', content: 'Write a caption' },
      { role: 'assistant', content: '{"tweets":["one","two","three"]}' },
      { role: 'user', content: 'Shorter' },
    ]);
  });
});
