// The compare's prompts and the JSON each model must answer with.
import { WRITING_TWEET_COUNT } from '@squidbox/shared';
import { z } from 'zod';
import type { ChatMessage, JsonSchemaSpec } from './venice.js';

/**
 * Writing as the user: their About you / Tone, once that setup exists. Null in this build; the
 * server will read it from the user's own data, so the compare request keeps its shape.
 */
export type Persona = { aboutYou: string; tone: string } | null;

export function writingMessages({ prompt, persona }: { prompt: string; persona: Persona }): ChatMessage[] {
  const system = [
    'You write social posts for a content creator.',
    persona && `About the creator: ${persona.aboutYou}\nTheir tone: ${persona.tone}`,
    `Reply with exactly ${WRITING_TWEET_COUNT} posts, each only the finished post text, ` +
      'no numbering, quotes or commentary, as a JSON object: {"tweets": [...]}.',
  ]
    .filter(Boolean)
    .join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];
}

// The user's prompt says what to look for and how many tags; the system message only fixes the
// answer's shape.
export function visionMessages({ prompt, imageDataUrl }: { prompt: string; imageDataUrl: string }): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You tag photos for a content creator. Reply with the tags only, no duplicates, no commentary, ' +
        'as a JSON object: {"tags": [...]}.',
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];
}

// A JSON object holding one list of strings, of exactly `count` when given.
function stringListSchema(key: string, count?: number) {
  const sized = count === undefined ? {} : { minItems: count, maxItems: count };
  return {
    type: 'object',
    properties: { [key]: { type: 'array', items: { type: 'string' }, ...sized } },
    required: [key],
    additionalProperties: false,
  };
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
