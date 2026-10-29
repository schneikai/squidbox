// What the assistant is told before each request. Editing the instructions is an ai_admin tool: for
// such an account its synced `instructions` record (its id is the user's id), each kind's null
// replaced by the app's default; every other account gets the defaults. Another account's stored
// overrides stay as they are; they only don't apply.
import { and, eq, isNull } from 'drizzle-orm';
import { resolveInstructions, type Instructions } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { instructions, type User } from '../db/schema.js';

/** The user's instructions (an ai_admin's overrides), with the default for every kind not changed. */
export async function readInstructions(db: Db, user: Pick<User, 'id' | 'features'>): Promise<Instructions> {
  if (!user.features.includes('ai_admin')) return resolveInstructions(null);
  const userId = user.id;
  const [row] = await db
    .select({
      writing: instructions.writing,
      visionTagging: instructions.visionTagging,
      moreLikeThis: instructions.moreLikeThis,
      modelCheckJudge: instructions.modelCheckJudge,
    })
    .from(instructions)
    .where(and(eq(instructions.userId, userId), eq(instructions.id, userId), isNull(instructions.deletedAt)));
  return resolveInstructions(row ?? null);
}
