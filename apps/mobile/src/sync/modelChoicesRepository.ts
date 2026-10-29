import {
  MODEL_CHOICE_FIELDS,
  type AiModelKind,
  type ModelChoiceFields,
  type ModelDefaultVariant,
} from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { ModelRef } from './aiStateRepository';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { saveUserRecord } from './userRecord';

// An ai_admin's picks of each kind's Default and Uncensored default (the switches on a model's
// page), which their account uses until Make default for everyone publishes them: the only reader
// and writer of the model_choices table. One record per user, whose id is the user's id; null is the
// published default.

const t = schema.modelChoices;

const EMPTY_MODEL_CHOICES: ModelChoiceFields = Object.freeze({
  writingModel: null,
  visionModel: null,
  writingUncensoredModel: null,
  visionUncensoredModel: null,
});

function save(
  db: SyncDb,
  userId: string,
  changes: (stored: ModelChoiceFields | null) => Partial<ModelChoiceFields>,
): Promise<void> {
  return saveUserRecord(db, 'model_choices', t, userId, changes, EMPTY_MODEL_CHOICES);
}

/** The picks of every kind and variant (null where there is none). */
export async function readChosenModels(db: SyncDb, userId: string): Promise<ModelChoiceFields> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, userId), isNull(t.deletedAt)));
  return {
    writingModel: row?.writingModel ?? null,
    visionModel: row?.visionModel ?? null,
    writingUncensoredModel: row?.writingUncensoredModel ?? null,
    visionUncensoredModel: row?.visionUncensoredModel ?? null,
  };
}

/**
 * Picks `model` as this account's default of `kind` for `variant`, or null to follow the published
 * default again. A pick equal to the published default (`publishedId`) is no pick, so it is stored as
 * null. `publishedId` comes from a catalog that may be up to five minutes old: a pick equal to a newer
 * publish is then stored as a pick, resolves to the same id, and clears on the next equal publish.
 */
export function pickDefault(
  db: SyncDb,
  userId: string,
  kind: AiModelKind,
  variant: ModelDefaultVariant,
  model: ModelRef | null,
  publishedId: string,
): Promise<void> {
  const field = MODEL_CHOICE_FIELDS[kind][variant];
  const value = model && model.id !== publishedId ? { id: model.id, name: model.name } : null;
  return save(db, userId, (stored) =>
    (stored?.[field]?.id ?? null) === (value?.id ?? null) ? {} : { [field]: value },
  );
}

/**
 * After Make default for everyone: clears the picks of `kind` equal to the newly `published`
 * defaults, so the account follows them again. A pick changed during the request is kept.
 */
export function clearPicksEqualTo(
  db: SyncDb,
  userId: string,
  kind: AiModelKind,
  published: Record<ModelDefaultVariant, string>,
): Promise<void> {
  return save(db, userId, (stored) => {
    const changes: Partial<ModelChoiceFields> = {};
    for (const [variant, field] of Object.entries(MODEL_CHOICE_FIELDS[kind]) as [
      ModelDefaultVariant,
      keyof ModelChoiceFields,
    ][]) {
      if (stored?.[field] && stored[field].id === published[variant]) changes[field] = null;
    }
    return changes;
  });
}
