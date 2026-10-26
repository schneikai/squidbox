// What the assistant is told before each request: the user's synced `instructions` record (its id is
// the user's id), each kind's null replaced by the app's default.
import { and, eq, isNull } from 'drizzle-orm';
import { APP_PROMPT_KINDS, DEFAULT_INSTRUCTIONS, resolveInstructions, type Instructions } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { instructions, type User } from '../db/schema.js';

/**
 * The user's instructions, with the default for every kind they haven't changed. Their own app
 * prompts (APP_PROMPT_KINDS) apply only to an ai_admin account; anyone else's requests get the app's.
 */
export async function readInstructions(db: Db, user: Pick<User, 'id' | 'features'>): Promise<Instructions> {
  const userId = user.id;
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
  if (user.features.includes('ai_admin')) return resolved;
  return { ...resolved, ...Object.fromEntries(APP_PROMPT_KINDS.map((kind) => [kind, DEFAULT_INSTRUCTIONS[kind]])) };
}
