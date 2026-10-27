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
 * The writing system message: the user's writing instructions (theirs or the default), their persona
 * and their Favorites (`favorites`, the texts, newest first), either of which may be missing, framed
 * by `instructions.personaFraming`, the chat's context when there is one (`instructions.chatContext`),
 * then the reply format (`instructions.writingFormat`).
 */
function writingSystem({
  persona,
  favorites,
  instructions,
  context,
}: {
  persona: Persona;
  favorites: string[];
  instructions: Instructions;
  context?: ChatContext;
}): ChatMessage {
  const content = [
    instructions.writing,
    (persona || favorites.length > 0) && personaText(instructions.personaFraming, persona, favorites),
    context && chatContextText(instructions.chatContext, context),
    writingFormatText(instructions.writingFormat),
  ]
    .filter(Boolean)
    .join('\n\n');
  return { role: 'system', content };
}

/** The writing prompt of a compare, as the user: the writing system message, then the prompt. */
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
  return [writingSystem({ persona, favorites, instructions }), { role: 'user', content: prompt }];
}

/**
 * The assistant chat, as the user: the writing system message with the chat's context, then the
 * transcript, a past reply in the JSON the model replies in.
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
    writingSystem({ persona, favorites, instructions, context }),
    ...transcript.map((turn): ChatMessage =>
      turn.role === 'user'
        ? { role: 'user', content: turn.content }
        : { role: 'assistant', content: JSON.stringify({ tweets: turn.tweets }) },
    ),
  ];
}

const PLACEHOLDER = /\{(\w+)\}/;

/**
 * `template` filled with `values`, where a line whose placeholder is empty goes, with a heading line
 * (one ending in ':', without a placeholder) right above it. The result is trimmed.
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
  return fillTemplate(lines.join('\n'), values).trim();
}

// The persona and favorites in `template` (personaFraming): every field that is filled, and the
// favorites as example posts.
function personaText(template: string, persona: Persona, favorites: string[]): string {
  return fillLines(template, {
    aboutYou: persona?.aboutYou ?? '',
    tone: persona?.tone ?? '',
    contentTags: persona?.contentTags.join(', ') ?? '',
    rules: persona?.rules.map((rule) => `- ${rule}`).join('\n') ?? '',
    favorites: favorites.length > 0 ? `${favorites.map((post) => `---\n${post}`).join('\n')}\n---` : '',
  });
}

const SUBJECTS: Record<ChatContext['kind'], string> = {
  draft: 'a new post',
  edit: 'a post of theirs they are changing',
};

// "2 photos, 1 video", empty without media.
function mediaText({ photo, video }: ChatContext['media']): string {
  const count = (n: number, one: string) => (n === 0 ? null : `${n} ${one}${n === 1 ? '' : 's'}`);
  return [count(photo, 'photo'), count(video, 'video')].filter(Boolean).join(', ');
}

/** What the chat's post is, in `template` (chatContext); a line whose value is empty is left out. */
export function chatContextText(template: string, context: ChatContext): string {
  return fillLines(template, {
    subject: SUBJECTS[context.kind],
    media: mediaText(context.media),
    tags: context.tags.join(', '),
    mentions: context.mentions.join(', '),
    text: context.text.trim(),
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

export const tagsSchema: JsonSchemaSpec<{ tags: string[] }> = {
  name: 'tags',
  jsonSchema: stringListSchema('tags'),
  zod: z.object({ tags: z.array(z.string()) }),
};
