import type { AiModelKind } from '@squidbox/shared';
import { eq, like } from 'drizzle-orm';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';

// The model testing's memory, in the library's local `ai_state` table (one JSON value per key):
// the chosen model and your models per kind, the writing prompt, the vision photo set and the
// scores. The only reader and writer of that table. A row of the wrong shape throws: there is no
// silent default for a corrupt row; a missing row is the one legitimate "nothing yet".

export type ModelRef = { id: string; name: string };

const chosenKey = (kind: AiModelKind) => `chosenModel:${kind}`;
const yourModelsKey = (kind: AiModelKind) => `yourModels:${kind}`;
const scorePrefix = (kind: AiModelKind) => `score:${kind}:`;
const WRITING_PROMPT_KEY = 'writingPrompt';
const VISION_PHOTOS_KEY = 'visionPhotoIds';

type Check<T> = (value: unknown) => value is T;

const isString = (value: unknown): value is string => typeof value === 'string';
const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isScore = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isModelRef = (value: unknown): value is ModelRef =>
  typeof value === 'object' && value !== null && isString((value as ModelRef).id) && isString((value as ModelRef).name);
const isModelRefList = (value: unknown): value is ModelRef[] => Array.isArray(value) && value.every(isModelRef);

function checked<T>(key: string, value: unknown, check: Check<T>): T {
  if (!check(value)) throw new Error(`ai_state "${key}" holds an unexpected value`);
  return value;
}

async function readAiState<T>(db: SyncDb, key: string, check: Check<T>): Promise<T | null> {
  const [row] = await db.select().from(schema.aiState).where(eq(schema.aiState.key, key));
  return row ? checked(key, row.value, check) : null;
}

async function writeAiState(db: SyncDb, key: string, value: unknown): Promise<void> {
  await db
    .insert(schema.aiState)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.aiState.key, set: { value } });
}

async function deleteAiState(db: SyncDb, key: string): Promise<void> {
  await db.delete(schema.aiState).where(eq(schema.aiState.key, key));
}

/** The model the coming assistant uses for this kind; null until one is picked. */
export function readChosenModel(db: SyncDb, kind: AiModelKind): Promise<ModelRef | null> {
  return readAiState(db, chosenKey(kind), isModelRef);
}

export function setChosenModel(db: SyncDb, kind: AiModelKind, model: ModelRef): Promise<void> {
  return writeAiState(db, chosenKey(kind), { id: model.id, name: model.name });
}

/** Your picked models of this kind, in the order added; null when never seeded. */
export function readYourModels(db: SyncDb, kind: AiModelKind): Promise<ModelRef[] | null> {
  return readAiState(db, yourModelsKey(kind), isModelRefList);
}

/** Adds a model at the end of your list; one already there stays where it is. */
export function addYourModel(db: SyncDb, kind: AiModelKind, model: ModelRef): Promise<void> {
  return db.transaction(async (tx) => {
    const models = (await readYourModels(tx, kind)) ?? [];
    if (models.some(({ id }) => id === model.id)) return;
    await writeAiState(tx, yourModelsKey(kind), [...models, { id: model.id, name: model.name }]);
  });
}

/** Takes a model off your list, and off the choice when it was chosen. Its score stays. */
export function removeYourModel(db: SyncDb, kind: AiModelKind, modelId: string): Promise<void> {
  return db.transaction(async (tx) => {
    const models = (await readYourModels(tx, kind)) ?? [];
    await writeAiState(
      tx,
      yourModelsKey(kind),
      models.filter(({ id }) => id !== modelId),
    );
    if ((await readChosenModel(tx, kind))?.id === modelId) await deleteAiState(tx, chosenKey(kind));
  });
}

/** Starts your list with these models, once: a list that exists (even empty) is left as it is. */
export function seedYourModels(db: SyncDb, kind: AiModelKind, models: ModelRef[]): Promise<void> {
  return db.transaction(async (tx) => {
    if ((await readYourModels(tx, kind)) !== null) return;
    await writeAiState(
      tx,
      yourModelsKey(kind),
      models.map(({ id, name }) => ({ id, name })),
    );
  });
}

/** The prompt of the last writing compare; null before the first. */
export function readWritingPrompt(db: SyncDb): Promise<string | null> {
  return readAiState(db, WRITING_PROMPT_KEY, isString);
}

export function setWritingPrompt(db: SyncDb, prompt: string): Promise<void> {
  return writeAiState(db, WRITING_PROMPT_KEY, prompt);
}

/** The asset ids of the last vision compare's photos; null before the first. */
export function readVisionPhotoIds(db: SyncDb): Promise<string[] | null> {
  return readAiState(db, VISION_PHOTOS_KEY, isStringList);
}

export function setVisionPhotoIds(db: SyncDb, assetIds: string[]): Promise<void> {
  return writeAiState(db, VISION_PHOTOS_KEY, assetIds);
}

/** Every model's score of this kind (thumbs up / tags that fit), by model id. */
export async function readScores(db: SyncDb, kind: AiModelKind): Promise<Record<string, number>> {
  const prefix = scorePrefix(kind);
  const rows = await db
    .select()
    .from(schema.aiState)
    .where(like(schema.aiState.key, `${prefix}%`));
  return Object.fromEntries(rows.map((row) => [row.key.slice(prefix.length), checked(row.key, row.value, isScore)]));
}

/** Adds `delta` (±1) to a model's score; it never goes below 0. */
export function addScore(db: SyncDb, kind: AiModelKind, modelId: string, delta: number): Promise<void> {
  const key = `${scorePrefix(kind)}${modelId}`;
  return db.transaction(async (tx) => {
    const score = (await readAiState(tx, key, isScore)) ?? 0;
    await writeAiState(tx, key, Math.max(0, score + delta));
  });
}
