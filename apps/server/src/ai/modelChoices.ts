// The model the assistant uses for each kind: the user's synced `model_choices` record (its id is
// the user's id), or while they have chosen none the app's default for their persona's Adult
// content switch (resolveModelId, as the app shows it).
import { and, eq, isNull } from 'drizzle-orm';
import { resolveModelId, type AiModelKind } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { modelChoices, personas } from '../db/schema.js';

const columns = { writing: modelChoices.writingModel, vision: modelChoices.visionModel };

/** The id of the model the user chose for `kind`, or the default one. */
export async function readChosenModelId(db: Db, userId: string, kind: AiModelKind): Promise<string> {
  const [row] = await db
    .select({ model: columns[kind] })
    .from(modelChoices)
    .where(and(eq(modelChoices.userId, userId), eq(modelChoices.id, userId), isNull(modelChoices.deletedAt)));
  if (row?.model) return row.model.id;
  const [persona] = await db
    .select({ adultContent: personas.adultContent })
    .from(personas)
    .where(and(eq(personas.userId, userId), eq(personas.id, userId), isNull(personas.deletedAt)));
  return resolveModelId(kind, null, persona?.adultContent);
}
