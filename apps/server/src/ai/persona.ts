// "Writing as you": the persona the writing prompts take, read from the user's synced `personas`
// record, and "Fill it in for me", which drafts it from the user's posts.
import { and, desc, eq, isNull } from 'drizzle-orm';
import { PERSONA_LIMITS, type PersonaDraftResponse } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { personas } from '../db/schema.js';
import type { CatalogEntry } from './catalog.js';
import { checkTags } from './compare.js';
import { personaDraftMessages, personaDraftSchema, type Persona } from './prompts.js';
import { chatJsonAsync, VeniceError } from './venice.js';

// The posts a draft may pick as example posts.
const DRAFT_EXAMPLE_POSTS = 3;

/** The user's persona (their newest live record: one per user, its id is theirs), or null. */
export async function readPersona(db: Db, userId: string): Promise<Persona> {
  const [row] = await db
    .select({
      aboutYou: personas.aboutYou,
      contentTags: personas.contentTags,
      tone: personas.tone,
      useEmoji: personas.useEmoji,
      rules: personas.rules,
      examplePosts: personas.examplePosts,
    })
    .from(personas)
    .where(and(eq(personas.userId, userId), isNull(personas.deletedAt)))
    .orderBy(desc(personas.updatedAt))
    .limit(1);
  return row ?? null;
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
 * empty ones and case-insensitive duplicates, the example posts' indexes within the `postCount`
 * posts sent, once each, at most DRAFT_EXAMPLE_POSTS. Throws a VeniceError that says what's missing.
 */
export function checkDraft(reply: PersonaDraftResponse, postCount: number): PersonaDraftResponse {
  const aboutYou = reply.aboutYou.trim().slice(0, PERSONA_LIMITS.aboutYou);
  const tone = reply.tone.trim().slice(0, PERSONA_LIMITS.tone);
  if (!aboutYou) throw new VeniceError('Returned no About you');
  if (!tone) throw new VeniceError('Returned no Tone');
  const contentTags = checkTags(reply.contentTags)
    .filter((tag) => tag.length <= PERSONA_LIMITS.contentTag)
    .slice(0, PERSONA_LIMITS.contentTags);
  const examplePostIndexes = [...new Set(reply.examplePostIndexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < postCount)
    .slice(0, DRAFT_EXAMPLE_POSTS);
  return { aboutYou, contentTags, tone, examplePostIndexes };
}
