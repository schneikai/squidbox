import type { InstructionKind, InstructionRecord } from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { saveUserRecord } from './userRecord';

// Instructions (Settings → Assistant): the only reader and writer of the instructions table. One
// record per user, whose id is the user's id; a null text is the app's default (resolveInstructions).

const t = schema.instructions;

const EMPTY_INSTRUCTIONS = Object.freeze({
  writing: null,
  visionTagging: null,
  moreLikeThis: null,
  modelCheckJudge: null,
});

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
  const stored = await readInstructions(db, userId);
  if (stored ? stored[kind] === value : value === null) return;
  await saveUserRecord(db, 'instructions', t, userId, { [kind]: value }, EMPTY_INSTRUCTIONS);
}
