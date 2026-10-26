import type { AiModelKind, ModelChoiceRecord } from '@squidbox/shared';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

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

const { aiKinds, aiModels } = schema;

/**
 * Moves the model the assistant used, which this library kept on the device before the choice synced
 * (ai_kinds' chosen_model_id), into the account's record once, and clears it there. A kind the record
 * already has a choice for keeps it.
 */
export async function importLocalModelChoices(db: SyncDb, userId: string): Promise<void> {
  const chosen = await db
    .select({ kind: aiKinds.kind, id: aiModels.modelId, name: aiModels.name })
    .from(aiKinds)
    .leftJoin(aiModels, and(eq(aiModels.kind, aiKinds.kind), eq(aiModels.modelId, aiKinds.chosenModelId)))
    .where(isNotNull(aiKinds.chosenModelId));
  if (chosen.length === 0) return;
  await save(db, userId, (stored) => {
    const changes: Partial<ModelChoiceFields> = {};
    for (const { kind, id, name } of chosen) {
      const field = FIELDS[kind as AiModelKind];
      if (field && id !== null && name !== null && stored?.[field] == null) changes[field] = { id, name };
    }
    return changes;
  });
  await db.update(aiKinds).set({ chosenModelId: null });
}
