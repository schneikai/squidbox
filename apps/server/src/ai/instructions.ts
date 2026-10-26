// What the assistant is told before each request: the user's synced `instructions` record (its id is
// the user's id), each kind's null replaced by the app's default.
import { and, eq, isNull } from 'drizzle-orm';
import { APP_PROMPT_KINDS, DEFAULT_INSTRUCTIONS, resolveInstructions, type Instructions } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { instructions } from '../db/schema.js';

/** The user's instructions, with the default for every kind they haven't changed. */
export async function readInstructions(db: Db, userId: string): Promise<Instructions> {
  const [row] = await db
    .select({
      writing: instructions.writing,
      visionTagging: instructions.visionTagging,
      writingFormat: instructions.writingFormat,
      tagsSystem: instructions.tagsSystem,
      themesContext: instructions.themesContext,
      personaFraming: instructions.personaFraming,
    })
    .from(instructions)
    .where(and(eq(instructions.userId, userId), eq(instructions.id, userId), isNull(instructions.deletedAt)));
  const resolved = resolveInstructions(row ?? null);
  if (usesOwnAppPrompts(userId)) return resolved;
  return { ...resolved, ...Object.fromEntries(APP_PROMPT_KINDS.map((kind) => [kind, DEFAULT_INSTRUCTIONS[kind]])) };
}

// Gate with ai_admin: whether the user's own app prompts (APP_PROMPT_KINDS) apply to their requests.
// Any user's for now: an edit only changes that user's own requests.
function usesOwnAppPrompts(_userId: string): boolean {
  return true;
}
