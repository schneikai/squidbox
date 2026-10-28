// The model the assistant uses for each kind. Choosing a model is an ai_admin tool: for such an
// account its synced `model_choices` record (its id is the user's id), else, and for every other
// account, the default for its persona's Adult content switch (model_defaults, resolveModelId as the
// app shows it). Another account's stored choice stays as it is; it only doesn't apply.
import { and, eq, isNull } from 'drizzle-orm';
import { resolveModelId, type AiModelKind } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { modelChoices, personas, type User } from '../db/schema.js';
import { readModelDefaults } from './verification.js';

const columns = { writing: modelChoices.writingModel, vision: modelChoices.visionModel };

/** The id of the model the user chose for `kind` (an ai_admin only), or the default one. */
export async function readChosenModelId(
  db: Db,
  user: Pick<User, 'id' | 'features'>,
  kind: AiModelKind,
): Promise<string> {
  const userId = user.id;
  const [choice, persona, defaults] = await Promise.all([
    user.features.includes('ai_admin')
      ? db
          .select({ model: columns[kind] })
          .from(modelChoices)
          .where(and(eq(modelChoices.userId, userId), eq(modelChoices.id, userId), isNull(modelChoices.deletedAt)))
          .then(([row]) => row?.model ?? null)
      : null,
    db
      .select({ adultContent: personas.adultContent })
      .from(personas)
      .where(and(eq(personas.userId, userId), eq(personas.id, userId), isNull(personas.deletedAt)))
      .then(([row]) => row),
    readModelDefaults(db),
  ]);
  return resolveModelId(kind, choice, persona?.adultContent, defaults);
}
