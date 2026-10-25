import type { PersonaRecord } from '@squidbox/shared';
import { desc, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { makeRepository } from './repository';

// "Writing as you" (Settings → Assistant): the only reader and writer of the personas table.

export type PersonaFields = Pick<
  PersonaRecord,
  'aboutYou' | 'contentTags' | 'tone' | 'useEmoji' | 'rules' | 'examplePosts'
>;

/** The persona's fields before anything was saved. */
export const EMPTY_PERSONA: PersonaFields = Object.freeze({
  aboutYou: '',
  contentTags: [],
  tone: '',
  useEmoji: false,
  rules: [],
  examplePosts: [],
}) as PersonaFields;

const FIELDS = Object.keys(EMPTY_PERSONA) as (keyof PersonaFields)[];

const repository = makeRepository<PersonaRecord>('personas', schema.personas);

/** The persona (the newest live record, should a device ever have made a second), or null. */
export async function readPersona(db: SyncDb): Promise<PersonaRecord | null> {
  const [row] = await db
    .select()
    .from(schema.personas)
    .where(isNull(schema.personas.deletedAt))
    .orderBy(desc(schema.personas.updatedAt))
    .limit(1);
  return (row as PersonaRecord | undefined) ?? null;
}

/**
 * Save the persona: the first save creates it with the user's id as its id (so every device writes
 * the same record), later ones update it with only the fields that differ from the stored ones, and
 * nothing when none differ. An unchanged list keeps its clock, so it can't overwrite another
 * device's edit of it in the per-field merge.
 */
export async function savePersona(db: SyncDb, userId: string, fields: PersonaFields): Promise<void> {
  const stored = await readPersona(db);
  if (!stored) {
    const now = Date.now();
    await repository.create(db, { id: userId, createdAt: now, updatedAt: now, deletedAt: null, ...fields });
    return;
  }
  const changes = Object.fromEntries(
    FIELDS.filter((field) => !isSameValue(stored[field], fields[field])).map((field) => [field, fields[field]]),
  ) as Partial<PersonaRecord>;
  if (Object.keys(changes).length > 0) await repository.update(db, stored.id, changes);
}

function isSameValue(a: unknown, b: unknown): boolean {
  return Array.isArray(a) ? JSON.stringify(a) === JSON.stringify(b) : a === b;
}
