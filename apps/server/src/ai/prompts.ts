// The AI's prompts and the JSON each model must answer with.
import { WRITING_TWEET_COUNT, type PersonaFields } from '@squidbox/shared';
import { z } from 'zod';
import type { ChatMessage, JsonSchemaSpec } from './venice.js';

/** Writing as the user: their "Writing as you" setup, or null before they saved one (persona.ts). */
export type Persona = PersonaFields | null;

// The reply formats the app adds after the user's instructions, which the schemas and checks rely on:
// an instruction that asks for something else still gets these.
export const WRITING_FORMAT =
  `Reply with exactly ${WRITING_TWEET_COUNT} posts, each only the finished post text, ` +
  'no numbering, quotes or commentary, as a JSON object: {"tweets": [...]}.';
export const TAGS_SYSTEM =
  'You tag photos for a content creator. Reply with the tags only, no duplicates, no commentary, ' +
  'as a JSON object: {"tags": [...]}.';

/**
 * The writing prompt, as the user: their writing instructions (`instructions`, theirs or the
 * default), their persona and their Favorites (`favorites`, the texts, newest first), either of which
 * may be missing, then the fixed reply format.
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
  instructions: string;
}): ChatMessage[] {
  const system = [instructions, (persona || favorites.length > 0) && personaText(persona, favorites), WRITING_FORMAT]
    .filter(Boolean)
    .join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];
}

// The persona as the system message describes it, in the screen's order: every field that is
// filled, and the favorites as example posts.
function personaText(persona: Persona, favorites: string[]): string {
  const hasPosts = favorites.length > 0;
  return [
    persona?.aboutYou && `About the creator: ${persona.aboutYou}`,
    persona?.tone && `Their tone: ${persona.tone}`,
    persona && persona.contentTags.length > 0 && `Their content: ${persona.contentTags.join(', ')}`,
    persona &&
      persona.rules.length > 0 &&
      `Rules, always follow them:\n${persona.rules.map((rule) => `- ${rule}`).join('\n')}`,
    hasPosts &&
      `Example posts they wrote. Write like these:\n${favorites.map((post) => `---\n${post}`).join('\n')}\n---`,
  ]
    .filter(Boolean)
    .join('\n');
}

// The user's prompt (their Photo tags instructions, which the app sends) says what to look for and how
// many tags; the system message only fixes the answer's shape.
export function visionMessages({ prompt, imageDataUrl }: { prompt: string; imageDataUrl: string }): ChatMessage[] {
  return [
    { role: 'system', content: TAGS_SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
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
