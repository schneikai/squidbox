// The model the assistant uses for each kind: the user's synced `model_choices` record (its id is
// the user's id), or the app's default while they have chosen none.
import { and, eq, isNull } from 'drizzle-orm';
import { DEFAULT_MODEL_IDS, type AiModelKind } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { modelChoices } from '../db/schema.js';

const columns = { writing: modelChoices.writingModel, vision: modelChoices.visionModel };

/** The id of the model the user chose for `kind`, or the default one. */
export async function readChosenModelId(db: Db, userId: string, kind: AiModelKind): Promise<string> {
  const [row] = await db
    .select({ model: columns[kind] })
    .from(modelChoices)
    .where(and(eq(modelChoices.userId, userId), eq(modelChoices.id, userId), isNull(modelChoices.deletedAt)));
  return row?.model?.id ?? DEFAULT_MODEL_IDS[kind];
}
