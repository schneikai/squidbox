import { INSTRUCTION_KINDS, type InstructionKind, type InstructionRecord, type Instructions } from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { saveUserRecord } from './userRecord';

// Instructions (Settings → Assistant): the only reader and writer of the instructions table. One
// record per user, whose id is the user's id; a null text is the app's default (resolveInstructions).

const t = schema.instructions;

const EMPTY_INSTRUCTIONS = Object.freeze(
  Object.fromEntries(INSTRUCTION_KINDS.map((kind) => [kind, null])) as Record<InstructionKind, null>,
);

/** The user's instructions, or null before the first save. */
export async function readInstructions(db: SyncDb, userId: string): Promise<InstructionRecord | null> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, userId), isNull(t.deletedAt)));
  return (row as InstructionRecord | undefined) ?? null;
}

/**
 * Save the user's text for one kind, or null to go back to the app's default, `defaultText`. A text
 * equal to it is stored as null, so a kind counts as changed only while its text differs.
 */
export async function saveInstruction(
  db: SyncDb,
  userId: string,
  kind: InstructionKind,
  text: string | null,
  defaultText: string,
): Promise<void> {
  const value = text === null || text.trim() === defaultText ? null : text.trim();
  await saveInstructions(db, userId, (stored) => ((stored?.[kind] ?? null) === value ? {} : { [kind]: value }));
}

/**
 * Clears each override equal to the app's text of its kind (`defaultTexts`, as the server publishes
 * it), so one that matches a text published since no longer shadows later publishes. Writes only
 * when one does; returns whether it did.
 */
export async function clearInstructionsEqualTo(
  db: SyncDb,
  userId: string,
  defaultTexts: Instructions,
): Promise<boolean> {
  let cleared = false;
  await saveInstructions(db, userId, (stored) => {
    const kinds = INSTRUCTION_KINDS.filter((kind) => stored?.[kind]?.trim() === defaultTexts[kind]);
    cleared = kinds.length > 0;
    return Object.fromEntries(kinds.map((kind) => [kind, null]));
  });
  return cleared;
}

/**
 * Saves the changes `change` makes of the stored texts, inside the save's transaction, so a decision
 * based on a stored text never acts on one saved or pulled in between.
 */
function saveInstructions(
  db: SyncDb,
  userId: string,
  change: (
    stored: Partial<Record<InstructionKind, string | null>> | null,
  ) => Partial<Record<InstructionKind, string | null>>,
): Promise<void> {
  return saveUserRecord(db, 'instructions', t, userId, change, EMPTY_INSTRUCTIONS);
}
