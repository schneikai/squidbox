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
 * Save what the user changed in the persona (`changes`, the fields that differ from what the editor
 * opened with): the first save creates it with the user's id as its id (so every device writes the
 * same record), later ones update it. Only the changed fields get a new clock, also on the first
 * save, so a field the user didn't touch never overwrites another device's edit of it, even when
 * that edit hasn't been pulled yet.
 */
export async function savePersona(db: SyncDb, userId: string, changes: Partial<PersonaFields>): Promise<void> {
  const changed = Object.keys(changes);
  if (changed.length === 0) return;
  await db.transaction(async (tx) => {
    const stored = await readPersona(tx, userId);
    if (stored) {
      await saveRecords(tx, 'personas', t, [nextVersion<PersonaRecord>(stored, changes)], { previous: [stored] });
      return;
    }
    const record = newRecord(personaCollection, EMPTY_PERSONA, { ...changes, id: userId });
    const clocks = Object.fromEntries(changed.map((field) => [field, record.updatedAt]));
    await saveRecords(tx, 'personas', t, [record], { clocks: new Map([[userId, clocks]]) });
  });
}
