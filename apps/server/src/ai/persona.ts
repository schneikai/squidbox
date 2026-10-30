// "Writing as you": the persona and the user's own posts the writing prompts take, read from the
// user's synced `personas` record and `posts`.
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { PERSONA_FIELDS } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { personas, posts } from '../db/schema.js';
import type { Persona } from './prompts.js';

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

// The user's posts a writing prompt sends, so the model hears how they write.
export const POSTS_IN_PROMPT = 100;

/**
 * The texts of `limit` of the user's posted posts (live, posted, not a repost, with text), picked at
 * random by `seed`: the same seed picks the same posts in the same order, so a chat keeps its posts
 * from turn to turn.
 */
export async function readSamplePosts(
  db: Db,
  userId: string,
  seed: string,
  limit = POSTS_IN_PROMPT,
): Promise<string[]> {
  const rows = await db
    .select({ text: posts.text })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        isNull(posts.deletedAt),
        isNotNull(posts.postedAt),
        isNull(posts.rePostId),
        sql`trim(${posts.text}) <> ''`,
      ),
    )
    .orderBy(sql`md5(${posts.id} || ${seed})`)
    .limit(limit);
  return rows.map((row) => row.text);
}
