// What the assistant is told before each request. A kind's text resolves the same way here and in
// the app: an ai_admin's synced `instructions` record (its id is the user's id), where the field is
// set; else the default published for every account (Make default for everyone, app_instructions);
// else the built-in DEFAULT_INSTRUCTIONS. Overrides apply to ai_admins only: another account's stored
// overrides stay as they are; they only don't apply. Published defaults apply to every account.
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  DEFAULT_INSTRUCTIONS,
  INSTRUCTION_KINDS,
  resolveInstructions,
  type InstructionKind,
  type Instructions,
} from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { appInstructions, instructions, type User } from '../db/schema.js';

const kindSchema = z.enum(INSTRUCTION_KINDS);

/**
 * The app's default of every kind: the published text, else the built-in one. A row of an unknown
 * kind is broken data, so parsing throws (a 500), never a skip.
 */
export async function readAppInstructions(db: Db): Promise<Instructions> {
  const rows = await db.select({ kind: appInstructions.kind, text: appInstructions.text }).from(appInstructions);
  const published = Object.fromEntries(rows.map((row) => [kindSchema.parse(row.kind), row.text]));
  return { ...DEFAULT_INSTRUCTIONS, ...published };
}

/** The user's instructions: an ai_admin's overrides, with the app's default for every kind not changed. */
export async function readInstructions(db: Db, user: Pick<User, 'id' | 'features'>): Promise<Instructions> {
  const isAdmin = user.features.includes('ai_admin');
  const userId = user.id;
  const [appDefaults, rows] = await Promise.all([
    readAppInstructions(db),
    isAdmin
      ? db
          .select({
            writing: instructions.writing,
            visionTagging: instructions.visionTagging,
            moreLikeThis: instructions.moreLikeThis,
            modelCheckJudge: instructions.modelCheckJudge,
          })
          .from(instructions)
          .where(and(eq(instructions.userId, userId), eq(instructions.id, userId), isNull(instructions.deletedAt)))
      : Promise.resolve([]),
  ]);
  return resolveInstructions(rows[0] ?? null, appDefaults);
}

/**
 * Makes `text` the kind's default for every account. The built-in text deletes the kind's row, so a
 * later change to the built-in text (in a PR) applies again.
 */
export async function publishInstruction(
  db: Db,
  { kind, text }: { kind: InstructionKind; text: string },
): Promise<void> {
  if (text === DEFAULT_INSTRUCTIONS[kind]) {
    await db.delete(appInstructions).where(eq(appInstructions.kind, kind));
    return;
  }
  await db
    .insert(appInstructions)
    .values({ kind, text })
    .onConflictDoUpdate({ target: appInstructions.kind, set: { text } });
}
