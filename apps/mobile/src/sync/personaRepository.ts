import { personaCollection, type PersonaFields, type PersonaRecord } from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';

import { nextVersion } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { saveRecords } from './saveRecords';

import newRecord from '@/utils/newRecord';

// "Writing as you" (Settings → Assistant): the only reader and writer of the personas table. One
// record per user, whose id is the user's id.

const t = schema.personas;

/** The persona's fields before anything was saved. */
export const EMPTY_PERSONA: PersonaFields = Object.freeze({
  aboutYou: '',
  contentTags: [],
  tone: '',
  useEmoji: false,
  rules: [],
  examplePosts: [],
}) as PersonaFields;

/** The user's persona, or null before the first save. */
export async function readPersona(db: SyncDb, userId: string): Promise<PersonaRecord | null> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, userId), isNull(t.deletedAt)));
  return (row as PersonaRecord | undefined) ?? null;
}

/**
 * Save the persona: the first save creates it with the user's id as its id (so every device writes
 * the same record), later ones update it. Only the fields that differ from the stored ones get a new
 * clock (saveRecords), so an untouched field can't overwrite another device's edit of it.
 */
export async function savePersona(db: SyncDb, userId: string, fields: PersonaFields): Promise<void> {
  await db.transaction(async (tx) => {
    const stored = await readPersona(tx, userId);
    if (stored) {
      await saveRecords(tx, 'personas', t, [nextVersion(stored, fields)], { previous: [stored] });
    } else {
      await saveRecords(tx, 'personas', t, [newRecord(personaCollection, {}, { ...fields, id: userId })], {
        isNew: true,
      });
    }
  });
}
