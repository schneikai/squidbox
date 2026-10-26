// "Writing as you": the persona and the Favorites the writing prompts take, read from the user's
// synced `personas` record and `favorites`, and "Fill it in for me", which drafts it from the user's
// posts.
import { and, desc, eq, isNull } from 'drizzle-orm';
import { PERSONA_FIELDS, PERSONA_LIMITS, uniqueTags, type PersonaDraftResponse } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { favorites, personas } from '../db/schema.js';
import type { CatalogEntry } from './catalog.js';
import { DRAFT_EXAMPLE_POSTS, personaDraftMessages, personaDraftSchema, type Persona } from './prompts.js';
import { chatJsonAsync, VeniceError } from './venice.js';

// The persona's columns, read as the record's fields.
const personaColumns = Object.fromEntries(PERSONA_FIELDS.map((field) => [field, personas[field]])) as {
  [F in (typeof PERSONA_FIELDS)[number]]: (typeof personas)[F];
};

/** The user's persona (its record's id is the user's id), or null before they saved one. */
export async function readPersona(db: Db, userId: string): Promise<Persona> {
  const [row] = await db
    .select(personaColumns)
    .from(personas)
    .where(and(eq(personas.userId, userId), eq(personas.id, userId), isNull(personas.deletedAt)));
  return row ?? null;
}

// The Favorites a writing prompt sends: the newest weigh most, and the system message stays bounded.
export const FAVORITES_IN_PROMPT = 20;

/** The texts of the user's Favorites, newest first, at most `limit`. */
export async function readFavorites(db: Db, userId: string, limit = FAVORITES_IN_PROMPT): Promise<string[]> {
  const rows = await db
    .select({ text: favorites.text })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), isNull(favorites.deletedAt)))
    .orderBy(desc(favorites.createdAt), desc(favorites.id))
    .limit(limit);
  return rows.map((row) => row.text);
}

/** One model's draft of About you, the content tags and Tone from `posts`, checked (checkDraft). */
export async function draftPersonaAsync({
  posts,
  model,
  signal,
}: {
  posts: string[];
  model: CatalogEntry;
  signal?: AbortSignal;
}): Promise<PersonaDraftResponse> {
  const reply = await chatJsonAsync({
    model: model.id,
    messages: personaDraftMessages({ posts }),
    schema: personaDraftSchema,
    supportsResponseSchema: model.model_spec.capabilities.supportsResponseSchema !== false,
    signal,
  });
  return checkDraft(reply, posts.length);
}

/**
 * The draft trimmed and within the persona's limits: About you and Tone non-empty, the tags without
 * empty ones and case-insensitive duplicates (none is fine: the user adds them), the example posts' indexes within the `postCount`
 * posts sent, once each, at most DRAFT_EXAMPLE_POSTS. Throws a VeniceError that says what's missing.
 */
export function checkDraft(reply: PersonaDraftResponse, postCount: number): PersonaDraftResponse {
  const aboutYou = reply.aboutYou.trim().slice(0, PERSONA_LIMITS.aboutYou);
  const tone = reply.tone.trim().slice(0, PERSONA_LIMITS.tone);
  if (!aboutYou) throw new VeniceError('Returned no About you');
  if (!tone) throw new VeniceError('Returned no Tone');
  const contentTags = uniqueTags(reply.contentTags)
    .filter((tag) => tag.length <= PERSONA_LIMITS.contentTag)
    .slice(0, PERSONA_LIMITS.contentTags);
  const examplePostIndexes = [...new Set(reply.examplePostIndexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < postCount)
    .slice(0, DRAFT_EXAMPLE_POSTS);
  return { aboutYou, contentTags, tone, examplePostIndexes };
}
