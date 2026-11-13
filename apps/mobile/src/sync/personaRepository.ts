import { PERSONA_LIMITS, type PersonaFields, type PersonaRecord } from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { saveUserRecord } from './userRecord';

// "Writing as you" (Settings → Assistant): the only reader and writer of the personas table. One
// record per user, whose id is the user's id.

const t = schema.personas;

/** The persona's fields before anything was saved. */
export const EMPTY_PERSONA: PersonaFields = Object.freeze({
  aboutYou: '',
  tone: '',
  contentTags: [],
  rules: [],
  adultContent: false,
}) as PersonaFields;

/** The user's persona, or null before the first save. */
export async function readPersona(db: SyncDb, userId: string): Promise<PersonaRecord | null> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, userId), isNull(t.deletedAt)));
  return (row as PersonaRecord | undefined) ?? null;
}

/** Save what the user changed in the persona (the fields that differ from what the editor opened with). */
export async function savePersona(db: SyncDb, userId: string, changes: Partial<PersonaFields>): Promise<void> {
  await saveUserRecord(db, 'personas', t, userId, changes, EMPTY_PERSONA);
}

/**
 * Appends `text` (trimmed) to the rules: 'added', 'present' when a rule already says it, 'tooLong'
 * over PERSONA_LIMITS.rule, 'full' at PERSONA_LIMITS.rules; only 'added' writes.
 */
export async function addRule(
  db: SyncDb,
  userId: string,
  text: string,
): Promise<'added' | 'present' | 'tooLong' | 'full'> {
  const rule = text.trim();
  if (rule.length > PERSONA_LIMITS.rule) return 'tooLong';
  let result: 'added' | 'present' | 'full' = 'added';
  await editRules(db, userId, (rules) => {
    if (rules.includes(rule)) result = 'present';
    else if (rules.length >= PERSONA_LIMITS.rules) result = 'full';
    else return [...rules, rule];
    return null;
  });
  return result;
}

/** A stored rule as the editor opened it: where it was and what it said. */
export type SeededRule = { index: number; text: string };

/**
 * Where `seeded` is in `rules` now, after a sync may have moved or changed the list: its index if
 * its text is still there, else the first rule with that text, -1 when it's gone.
 */
function locateRule(rules: string[], { index, text }: SeededRule): number {
  return rules[index] === text ? index : rules.indexOf(text);
}

/**
 * Replaces the rule the editor opened (`seeded`, found again with locateRule, so a sync that moved
 * or changed the list never gets another rule overwritten) with `text` (trimmed): 'updated',
 * 'present' when another rule already says it, 'tooLong' over PERSONA_LIMITS.rule, 'gone' when the
 * rule isn't there anymore; only 'updated' writes.
 */
export async function updateRule(
  db: SyncDb,
  userId: string,
  seeded: SeededRule,
  text: string,
): Promise<'updated' | 'present' | 'tooLong' | 'gone'> {
  const rule = text.trim();
  if (rule.length > PERSONA_LIMITS.rule) return 'tooLong';
  let result: 'updated' | 'present' | 'gone' = 'updated';
  await editRules(db, userId, (rules) => {
    const at = locateRule(rules, seeded);
    if (at === -1) result = 'gone';
    else if (rules.some((other, i) => i !== at && other === rule)) result = 'present';
    else return rules.map((other, i) => (i === at ? rule : other));
    return null;
  });
  return result;
}

/** Removes the rule the editor opened (`seeded`, found again as in updateRule); one gone already stays gone. */
export async function removeRule(db: SyncDb, userId: string, seeded: SeededRule): Promise<void> {
  await editRules(db, userId, (rules) => {
    const at = locateRule(rules, seeded);
    return at === -1 ? null : rules.filter((_, i) => i !== at);
  });
}

/**
 * Saves the rules `edit` makes of the stored ones (null writes nothing). It runs inside the save's
 * transaction, so a rule saved or pulled in between is part of what it edits, never overwritten.
 */
function editRules(db: SyncDb, userId: string, edit: (rules: string[]) => string[] | null): Promise<void> {
  return saveUserRecord(
    db,
    'personas',
    t,
    userId,
    (stored: PersonaFields | null): Partial<PersonaFields> => {
      const rules = edit(stored?.rules ?? []);
      return rules ? { rules } : {};
    },
    EMPTY_PERSONA,
  );
}
