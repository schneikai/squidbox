import type { AiModelKind } from '@squidbox/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import * as schema from './db/schema';
import type { AssetRow } from './db/schema';
import type { SyncDb } from './db/types';

// The model testing's memory in the library's local ai_* tables (schema.ts): your models per kind,
// the chosen one, the scores, each kind's prompt and the vision photo set. Their only reader and
// writer.

export type ModelRef = { id: string; name: string };
// score: null for a model never compared, else its thumbs up or tags that fit (0 and up).
export type ModelListEntry = ModelRef & { score: number | null };

const { aiKinds, aiModels, aiScores, aiVisionPhotos, assets } = schema;

/**
 * Your models of this kind in the order added, each with its score, and the chosen one's id, in one
 * statement; null while the list was never seeded.
 */
export async function readModelList(
  db: SyncDb,
  kind: AiModelKind,
): Promise<{ chosenId: string | null; models: ModelListEntry[] } | null> {
  const rows = await db
    .select({
      chosenId: aiKinds.chosenModelId,
      id: aiModels.modelId,
      name: aiModels.name,
      score: aiScores.score,
    })
    .from(aiKinds)
    .leftJoin(aiModels, eq(aiModels.kind, aiKinds.kind))
    .leftJoin(aiScores, and(eq(aiScores.kind, aiModels.kind), eq(aiScores.modelId, aiModels.modelId)))
    .where(eq(aiKinds.kind, kind))
    .orderBy(asc(aiModels.position));
  if (rows.length === 0) return null;
  const models = rows.flatMap(({ id, name, score }) => (id !== null && name !== null ? [{ id, name, score }] : []));
  return { chosenId: rows[0].chosenId, models };
}

/** The chosen model of each kind (null when none), in one statement. */
export async function readChosenModels(db: SyncDb): Promise<Record<AiModelKind, ModelRef | null>> {
  const rows = await db
    .select({ kind: aiKinds.kind, id: aiModels.modelId, name: aiModels.name })
    .from(aiKinds)
    .innerJoin(aiModels, and(eq(aiModels.kind, aiKinds.kind), eq(aiModels.modelId, aiKinds.chosenModelId)));
  const chosen: Record<AiModelKind, ModelRef | null> = { writing: null, vision: null };
  for (const { kind, id, name } of rows) chosen[kind as AiModelKind] = { id, name };
  return chosen;
}

/** The id of the model the coming assistant uses for this kind; null until one is picked. */
export async function readChosenModelId(db: SyncDb, kind: AiModelKind): Promise<string | null> {
  const [row] = await db.select({ id: aiKinds.chosenModelId }).from(aiKinds).where(eq(aiKinds.kind, kind));
  return row?.id ?? null;
}

/** Chooses one of your models; it must be on your list (a seeded one). */
export async function setChosenModel(db: SyncDb, kind: AiModelKind, modelId: string): Promise<void> {
  await db.update(aiKinds).set({ chosenModelId: modelId }).where(eq(aiKinds.kind, kind));
}

/** Starts your list with these models, once: a seeded list (even emptied since) is left as it is. */
export function seedYourModels(db: SyncDb, kind: AiModelKind, models: ModelRef[]): Promise<void> {
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(aiKinds).values({ kind }).onConflictDoNothing().returning();
    if (inserted.length === 0 || models.length === 0) return;
    await tx
      .insert(aiModels)
      .values(models.map(({ id, name }, position) => ({ kind, modelId: id, name, position })))
      .onConflictDoNothing();
  });
}

/** Adds a model at the end of your list (which then counts as seeded); one already there stays put. */
export function addYourModel(db: SyncDb, kind: AiModelKind, model: ModelRef): Promise<void> {
  return db.transaction(async (tx) => {
    await tx.insert(aiKinds).values({ kind }).onConflictDoNothing();
    await tx
      .insert(aiModels)
      .values({
        kind,
        modelId: model.id,
        name: model.name,
        position: sql`(select coalesce(max(${aiModels.position}), -1) + 1 from ${aiModels} where ${aiModels.kind} = ${kind})`,
      })
      .onConflictDoNothing();
  });
}

/** Takes a model off your list, and off the choice when it was chosen. Its score stays. */
export function removeYourModel(db: SyncDb, kind: AiModelKind, modelId: string): Promise<void> {
  return db.transaction(async (tx) => {
    await tx.delete(aiModels).where(and(eq(aiModels.kind, kind), eq(aiModels.modelId, modelId)));
    await tx
      .update(aiKinds)
      .set({ chosenModelId: null })
      .where(and(eq(aiKinds.kind, kind), eq(aiKinds.chosenModelId, modelId)));
  });
}

/** The prompt of the last compare of this kind; null before the first. */
export async function readPrompt(db: SyncDb, kind: AiModelKind): Promise<string | null> {
  const [row] = await db.select({ prompt: aiKinds.prompt }).from(aiKinds).where(eq(aiKinds.kind, kind));
  return row?.prompt ?? null;
}

/** Remembers a kind's prompt. A compare needs that kind's list, so its row is there. */
export async function setPrompt(db: SyncDb, kind: AiModelKind, prompt: string): Promise<void> {
  const updated = await db.update(aiKinds).set({ prompt }).where(eq(aiKinds.kind, kind)).returning();
  if (updated.length === 0) throw new Error(`The ${kind} models were never set up`);
}

/** The last vision compare's photos still in the library, in their order. */
export async function readVisionPhotos(db: SyncDb): Promise<AssetRow[]> {
  const rows = await db
    .select({ asset: assets })
    .from(aiVisionPhotos)
    .innerJoin(assets, eq(assets.id, aiVisionPhotos.assetId))
    .where(and(isNull(assets.deletedAt), isNull(assets.purgedAt)))
    .orderBy(asc(aiVisionPhotos.position));
  return rows.map(({ asset }) => asset);
}

export function setVisionPhotos(db: SyncDb, assetIds: string[]): Promise<void> {
  return db.transaction(async (tx) => {
    await tx.delete(aiVisionPhotos);
    if (assetIds.length === 0) return;
    await tx.insert(aiVisionPhotos).values(assetIds.map((assetId, position) => ({ assetId, position })));
  });
}

/** Records that these models answered a compare: a score of 0 for any without one yet. */
export async function markTried(db: SyncDb, kind: AiModelKind, modelIds: string[]): Promise<void> {
  if (modelIds.length === 0) return;
  await db
    .insert(aiScores)
    .values(modelIds.map((modelId) => ({ kind, modelId, score: 0 })))
    .onConflictDoNothing();
}

/** Takes one model (with `modelId`) or every model of this kind back to never compared. */
export async function resetScores(db: SyncDb, kind: AiModelKind, modelId?: string): Promise<void> {
  await db
    .delete(aiScores)
    .where(modelId ? and(eq(aiScores.kind, kind), eq(aiScores.modelId, modelId)) : eq(aiScores.kind, kind));
}

/** Adds `delta` (±1) to a model's score; it never goes below 0. */
export async function addScore(db: SyncDb, kind: AiModelKind, modelId: string, delta: number): Promise<void> {
  await db
    .insert(aiScores)
    .values({ kind, modelId, score: Math.max(0, delta) })
    .onConflictDoUpdate({
      target: [aiScores.kind, aiScores.modelId],
      set: { score: sql`max(0, ${aiScores.score} + ${delta})` },
    });
}
