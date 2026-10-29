// The model the assistant uses for each kind. For an ai_admin, their synced `model_choices` record
// (its id is the user's id): their picks of the Default and Uncensored default, tried on their own
// account before Make default for everyone publishes them, over the published defaults
// (model_defaults). For every other account the published defaults. Either way the variant follows
// the persona's Adult content switch (resolveModelId, as the app shows it). Another account's stored
// picks stay as they are; they only don't apply.
import { and, eq, isNull } from 'drizzle-orm';
import { resolveModelId, type AiModelKind } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { modelChoices, personas, type User } from '../db/schema.js';
import { readModelDefaults } from './verification.js';

/** The id of the model the user uses for `kind`: an ai_admin's pick, or the published default. */
export async function readChosenModelId(
  db: Db,
  user: Pick<User, 'id' | 'features'>,
  kind: AiModelKind,
): Promise<string> {
  const userId = user.id;
  const [picks, persona, defaults] = await Promise.all([
    user.features.includes('ai_admin')
      ? db
          .select()
          .from(modelChoices)
          .where(and(eq(modelChoices.userId, userId), eq(modelChoices.id, userId), isNull(modelChoices.deletedAt)))
          .then(([row]) => row ?? null)
      : null,
    db
      .select({ adultContent: personas.adultContent })
      .from(personas)
      .where(and(eq(personas.userId, userId), eq(personas.id, userId), isNull(personas.deletedAt)))
      .then(([row]) => row),
    readModelDefaults(db),
  ]);
  return resolveModelId(kind, picks, persona?.adultContent, defaults);
}
