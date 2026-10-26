// What the assistant is told before each request: the user's synced `instructions` record (its id is
// the user's id), each kind's null replaced by the app's default.
import { and, eq, isNull } from 'drizzle-orm';
import { resolveInstructions, type Instructions } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { instructions } from '../db/schema.js';

/** The user's instructions, with the default for every kind they haven't changed. */
export async function readInstructions(db: Db, userId: string): Promise<Instructions> {
  const [row] = await db
    .select({
      writing: instructions.writing,
      personaDraft: instructions.personaDraft,
      visionTagging: instructions.visionTagging,
    })
    .from(instructions)
    .where(and(eq(instructions.userId, userId), eq(instructions.id, userId), isNull(instructions.deletedAt)));
  return resolveInstructions(row ?? null);
}
