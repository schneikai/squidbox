import type { AiModelKind, ModelChoiceRecord } from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { ModelRef } from './aiStateRepository';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { saveUserRecord } from './userRecord';

// The model the assistant uses for each kind: the only reader and writer of the model_choices table.
// One record per user, whose id is the user's id; null is the app's default.

type ModelChoiceFields = Omit<ModelChoiceRecord, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

const t = schema.modelChoices;

const FIELDS = { writing: 'writingModel', vision: 'visionModel' } as const satisfies Record<
  AiModelKind,
  keyof ModelChoiceFields
>;

const EMPTY_MODEL_CHOICES: ModelChoiceFields = Object.freeze({ writingModel: null, visionModel: null });

function save(
  db: SyncDb,
  userId: string,
  changes: (stored: ModelChoiceFields | null) => Partial<ModelChoiceFields>,
): Promise<void> {
  return saveUserRecord(db, 'model_choices', t, userId, changes, EMPTY_MODEL_CHOICES);
}

/** The chosen model of each kind (null when none). */
export async function readChosenModels(db: SyncDb, userId: string): Promise<Record<AiModelKind, ModelRef | null>> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, userId), isNull(t.deletedAt)));
  return { writing: row?.writingModel ?? null, vision: row?.visionModel ?? null };
}

/** Chooses the model of a kind, or null to go back to the app's default. */
export function setChosenModel(db: SyncDb, userId: string, kind: AiModelKind, model: ModelRef | null): Promise<void> {
  const field = FIELDS[kind];
  const value = model && { id: model.id, name: model.name };
  return save(db, userId, (stored) =>
    (stored?.[field]?.id ?? null) === (value?.id ?? null) ? {} : { [field]: value },
  );
}
