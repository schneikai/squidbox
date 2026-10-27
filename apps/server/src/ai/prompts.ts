// The AI's prompts and the JSON each model must answer with.
import {
  WRITING_TWEET_COUNT,
  type ChatContext,
  type ChatTurn,
  type Instructions,
  type PersonaFields,
} from '@squidbox/shared';
import { z } from 'zod';
import type { ChatMessage, JsonSchemaSpec } from './venice.js';

/** Writing as the user: their "Writing as you" setup, or null before they saved one (persona.ts). */
export type Persona = PersonaFields | null;

/**
 * `template` with each `{name}` of `values` filled in (other braces stay as they are). The app
 * prompts are the user's to edit (APP_PROMPT_KINDS), so a template may lack a placeholder or have an
 * unknown one: neither fails, the reply's schema and checks still hold the model to its format.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? values[name]! : match));
}

/** The reply format the writing prompt ends with, `{count}` filled in. */
export function writingFormatText(template: string): string {
  return fillTemplate(template, { count: String(WRITING_TWEET_COUNT) });
}

/** The text the tags prompt adds after the user's instructions when the creator named their content. */
export function contentThemesText(template: string, contentTags: string[]): string {
  return fillTemplate(template, { themes: contentTags.join(', ') });
}

/**
 * The writing prompt of a compare, as the user: the writing instructions, their persona and Favorites
 * framed by `instructions.personaFraming` (when either exists) and the reply format
 * (`instructions.writingFormat`) as the system message, then the prompt.
 */
export function writingMessages({
  prompt,
  persona,
  favorites,
  instructions,
}: {
  prompt: string;
  persona: Persona;
  favorites: string[];
  instructions: Instructions;
}): ChatMessage[] {
  const content = [
    instructions.writing,
    (persona || favorites.length > 0) && personaText(instructions.personaFraming, persona, favorites),
    writingFormatText(instructions.writingFormat),
  ]
    .filter(Boolean)
    .join('\n\n');
  return [
    { role: 'system', content },
    { role: 'user', content: prompt },
  ];
}

/**
 * The assistant chat, as the user: the chat briefing (`instructions.chatContext`, filled with their
 * persona, Favorites and the post) as the whole system message, then the transcript, a past reply in
 * the JSON the model replies in.
 */
export function chatMessages({
  context,
  transcript,
  persona,
  favorites,
  instructions,
}: {
  context: ChatContext;
  transcript: ChatTurn[];
  persona: Persona;
  favorites: string[];
  instructions: Instructions;
}): ChatMessage[] {
  return [
    { role: 'system', content: chatBriefingText(instructions.chatContext, { persona, favorites, context }) },
    ...transcript.map((turn): ChatMessage =>
      turn.role === 'user'
        ? { role: 'user', content: turn.content }
        : { role: 'assistant', content: JSON.stringify({ reply: turn.reply, postOptions: turn.postOptions }) },
    ),
  ];
}

const PLACEHOLDER = /\{(\w+)\}/;

const HEADING = /^#/;

/**
 * `template` filled with `values`, where a line whose placeholder is empty goes, with a heading line
 * (one ending in ':', without a placeholder) right above it. Then a `#` heading left with nothing
 * under it before the next `#` heading or the end goes too, from the end up, so emptied sections go
 * one after the other; and blank lines left in a row become one. The result is trimmed.
 */
export function fillLines(template: string, values: Record<string, string>): string {
  const lines: string[] = [];
  for (const line of template.split('\n')) {
    const isEmpty = [...line.matchAll(/\{(\w+)\}/g)].some(([, name]) => name! in values && !values[name!]);
    if (!isEmpty) {
      lines.push(line);
      continue;
    }
    const above = lines[lines.length - 1];
    if (above !== undefined && above.trimEnd().endsWith(':') && !PLACEHOLDER.test(above)) lines.pop();
  }
  const kept: string[] = [];
  let isSectionEmpty = true; // nothing but blank lines since the next heading or the end
  for (const line of lines.reverse()) {
    if (HEADING.test(line)) {
      if (isSectionEmpty) continue;
      isSectionEmpty = true;
    } else if (line.trim()) {
      isSectionEmpty = false;
    }
    if (!line.trim() && kept.length > 0 && !kept[kept.length - 1]!.trim()) continue;
    kept.push(line);
  }
  return fillTemplate(kept.reverse().join('\n'), values).trim();
}

// The persona's own fields as template values: empty ones when there is none; rules as "- " lines.
function personaValues(persona: Persona): Record<string, string> {
  return {
    aboutYou: persona?.aboutYou ?? '',
    tone: persona?.tone ?? '',
    contentTags: persona?.contentTags.join(', ') ?? '',
    rules: persona?.rules.map((rule) => `- ${rule}`).join('\n') ?? '',
  };
}

// The persona and favorites in `template` (personaFraming): every field that is filled, and the
// favorites as example posts.
function personaText(template: string, persona: Persona, favorites: string[]): string {
  return fillLines(template, {
    ...personaValues(persona),
    favorites: favorites.length > 0 ? `${favorites.map((post) => `---\n${post}`).join('\n')}\n---` : '',
  });
}

// "4 photos and 1 video", "none yet" without media.
function mediaText({ photo, video }: ChatContext['media']): string {
  const count = (n: number, one: string) => (n === 0 ? null : `${n} ${one}${n === 1 ? '' : 's'}`);
  return [count(photo, 'photo'), count(video, 'video')].filter(Boolean).join(' and ') || 'none yet';
}

/**
 * The chat briefing, `template` (chatContext) filled with the creator's persona, their Favorites
 * (the texts, newest first, as "- " lines like the rules) and the chat's post: `{caption}` is the
 * caption as a JSON string, or (empty); `{count}` the options to write. A line whose value is empty is
 * left out, with its heading (fillLines).
 */
export function chatBriefingText(
  template: string,
  { persona, favorites, context }: { persona: Persona; favorites: string[]; context: ChatContext },
): string {
  const caption = context.text.trim();
  return fillLines(template, {
    ...personaValues(persona),
    favorites: favorites.map((post) => `- ${post}`).join('\n'),
    media: mediaText(context.media),
    tags: context.tags.join(', '),
    mentions: context.mentions.join(', '),
    caption: caption ? JSON.stringify(caption) : '(empty)',
    count: String(WRITING_TWEET_COUNT),
  });
}

// The user's prompt (their Photo tags instructions, which the app sends) says what to look for and how
// many tags; the system message (`instructions.tagsSystem`) fixes the answer's shape. The creator's
// content themes (their persona's `contentTags`, in `instructions.themesContext`), when they have any,
// follow the prompt as a text of their own, so they apply whatever the prompt says.
export function visionMessages({
  prompt,
  imageDataUrl,
  instructions,
  contentTags = [],
}: {
  prompt: string;
  imageDataUrl: string;
  instructions: Instructions;
  contentTags?: string[];
}): ChatMessage[] {
  const themes = contentTags.length > 0 ? [contentThemesText(instructions.themesContext, contentTags)] : [];
  return [
    { role: 'system', content: instructions.tagsSystem },
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...themes.map((text) => ({ type: 'text' as const, text })),
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];
}

// A JSON object of these properties, all required.
function objectSchema(properties: Record<string, unknown>) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

// A JSON object holding one list of strings, of exactly `count` when given.
function stringListSchema(key: string, count?: number) {
  const sized = count === undefined ? {} : { minItems: count, maxItems: count };
  return objectSchema({ [key]: { type: 'array', items: { type: 'string' }, ...sized } });
}

// The zod side is loose on purpose: the counts are checked in compare.ts, so a model that
// returns the wrong number gets that said on its card instead of "couldn't be read".
export const tweetsSchema: JsonSchemaSpec<{ tweets: string[] }> = {
  name: 'tweets',
  jsonSchema: stringListSchema('tweets', WRITING_TWEET_COUNT),
  zod: z.object({ tweets: z.array(z.string()) }),
};

// A chat reply: what the assistant says and the options for the post, when asked for (tasks.ts checks
// them and keeps the first CHAT_LIMITS.posts; a maxItems here invited ten options).
export const chatReplySchema: JsonSchemaSpec<{ reply: string; postOptions: string[] }> = {
  name: 'chat_reply',
  jsonSchema: objectSchema({
    reply: { type: 'string' },
    postOptions: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Options for the post being edited: finished post texts, one per item. Empty unless the creator asked for posts.',
    },
  }),
  zod: z.object({ reply: z.string(), postOptions: z.array(z.string()) }),
};

export const tagsSchema: JsonSchemaSpec<{ tags: string[] }> = {
  name: 'tags',
  jsonSchema: stringListSchema('tags'),
  zod: z.object({ tags: z.array(z.string()) }),
};
