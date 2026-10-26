// The AI's prompts and the JSON each model must answer with.
import { WRITING_TWEET_COUNT, type Instructions, type PersonaFields } from '@squidbox/shared';
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
 * The writing prompt, as the user: their writing instructions (theirs or the default), their persona
 * and their Favorites (`favorites`, the texts, newest first), either of which may be missing, framed
 * by `instructions.personaFraming`, then the reply format (`instructions.writingFormat`).
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
  const system = [
    instructions.writing,
    (persona || favorites.length > 0) && personaText(instructions.personaFraming, persona, favorites),
    writingFormatText(instructions.writingFormat),
  ]
    .filter(Boolean)
    .join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];
}

const PLACEHOLDER = /\{(\w+)\}/;

// The persona and favorites in `template` (personaFraming): every field that is filled, and the
// favorites as example posts. A line whose placeholder is empty goes, with a heading line (one
// ending in ':', without a placeholder) right above it.
function personaText(template: string, persona: Persona, favorites: string[]): string {
  const values: Record<string, string> = {
    aboutYou: persona?.aboutYou ?? '',
    tone: persona?.tone ?? '',
    contentTags: persona?.contentTags.join(', ') ?? '',
    rules: persona?.rules.map((rule) => `- ${rule}`).join('\n') ?? '',
    favorites: favorites.length > 0 ? `${favorites.map((post) => `---\n${post}`).join('\n')}\n---` : '',
  };
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
