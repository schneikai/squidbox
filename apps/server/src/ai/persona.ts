// "Writing as you": the persona and the Favorites the writing prompts take, read from the user's
// synced `personas` record and `favorites`.
import { and, desc, eq, isNull } from 'drizzle-orm';
import { PERSONA_FIELDS } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { favorites, personas } from '../db/schema.js';
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
