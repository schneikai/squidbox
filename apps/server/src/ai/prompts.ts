// The AI's prompts and the JSON each model must answer with.
import { WRITING_TWEET_COUNT, type PersonaRecord } from '@squidbox/shared';
import { z } from 'zod';
import type { ChatMessage, JsonSchemaSpec } from './venice.js';

/** Writing as the user: their "Writing as you" setup, or null before they saved one (persona.ts). */
export type Persona = Pick<PersonaRecord, 'aboutYou' | 'contentTags' | 'tone' | 'useEmoji' | 'rules' | 'examplePosts'> | null;

export function writingMessages({ prompt, persona }: { prompt: string; persona: Persona }): ChatMessage[] {
  const system = [
    'You write social posts for a content creator.',
    persona && personaText(persona),
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

// The persona as the system message describes it: every field that is filled, and the emoji switch.
function personaText({ aboutYou, contentTags, tone, useEmoji, rules, examplePosts }: NonNullable<Persona>): string {
  const hasPosts = examplePosts.length > 0;
  return [
    aboutYou && `About the creator: ${aboutYou}`,
    contentTags.length > 0 && `Their content: ${contentTags.join(', ')}`,
    tone && `Their tone: ${tone}`,
    useEmoji ? (hasPosts ? 'Use emoji, the way the example posts do.' : 'Use emoji.') : 'No emoji.',
    rules.length > 0 && `Rules, always follow them:\n${rules.map((rule) => `- ${rule}`).join('\n')}`,
    hasPosts && `Example posts they wrote. Write like these:\n${examplePosts.map((post) => `---\n${post}`).join('\n')}\n---`,
  ]
    .filter(Boolean)
    .join('\n');
}

// "Fill it in for me": the posts are numbered from 0, so the reply can pick the example posts by
// index and the app copies them verbatim.
export function personaDraftMessages({ posts }: { posts: string[] }): ChatMessage[] {
  const system = [
    'You help a content creator describe how they write, from their own posts.',
    'aboutYou: one or two sentences in their own voice, first person: who they are, what they post, ' +
      'who their fans are and what the fans come for. Only what the posts show.',
    'contentTags: 5 to 10 short lowercase tags for what their content is about.',
    'tone: one or two short sentences on how their posts sound: short or long, sweet or cocky, ' +
      'how explicit, emoji or not. Write it as an instruction, like "Short and cocky. Teases, never begs."',
    'examplePostIndexes: the numbers of up to 3 posts that best show their voice.',
    'Reply as a JSON object: {"aboutYou": "…", "contentTags": [...], "tone": "…", "examplePostIndexes": [...]}.',
  ].join('\n\n');
  const user = posts.map((post, index) => `Post ${index}:\n${post}`).join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
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

// The zod side is loose like the others: persona.ts checks the reply.
export const personaDraftSchema: JsonSchemaSpec<{
  aboutYou: string;
  contentTags: string[];
  tone: string;
  examplePostIndexes: number[];
}> = {
  name: 'persona',
  jsonSchema: objectSchema({
    aboutYou: { type: 'string' },
    contentTags: { type: 'array', items: { type: 'string' } },
    tone: { type: 'string' },
    examplePostIndexes: { type: 'array', items: { type: 'integer' } },
  }),
  zod: z.object({
    aboutYou: z.string(),
    contentTags: z.array(z.string()),
    tone: z.string(),
    examplePostIndexes: z.array(z.number()),
  }),
};
