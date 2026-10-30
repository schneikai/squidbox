import type { AiModelKind } from '@squidbox/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import * as schema from './db/schema';
import type { AssetRow } from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';

// The model testing's memory in the library's local ai_* tables (schema.ts): your models per kind,
// the scores, each kind's prompt and the vision photo set. Their only reader and writer. An ai_admin's
// picks of the defaults sync with the account (modelChoicesRepository).

export type ModelRef = { id: string; name: string };
// score: null for a model never compared, else its thumbs up or tags that fit (0 and up); note: what
// the admin noted about it, null without one.
export type ModelListEntry = ModelRef & { score: number | null; note: string | null };

const { aiKinds, aiModels, aiScores, aiVisionPhotos, assets } = schema;

/**
 * Your models of this kind in the order added, each with its score and note, in one statement; null
 * while the list was never seeded. A removed model isn't in it.
 */
export async function readModelList(db: SyncDb, kind: AiModelKind): Promise<ModelListEntry[] | null> {
  const rows = await db
    .select({
      id: aiModels.modelId,
      name: aiModels.name,
      note: aiModels.note,
      score: aiScores.score,
    })
    .from(aiKinds)
    .leftJoin(aiModels, and(eq(aiModels.kind, aiKinds.kind), eq(aiModels.isHidden, false)))
    .leftJoin(aiScores, and(eq(aiScores.kind, aiModels.kind), eq(aiScores.modelId, aiModels.modelId)))
    .where(eq(aiKinds.kind, kind))
    .orderBy(asc(aiModels.position));
  if (rows.length === 0) return null;
  return rows.flatMap(({ id, name, note, score }) => (id !== null && name !== null ? [{ id, name, note, score }] : []));
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

/**
 * Adds a model at the end of your list (which then counts as seeded); one already there stays put,
 * and a removed one comes back at the end with its note.
 */
export function addYourModel(db: SyncDb, kind: AiModelKind, model: ModelRef): Promise<void> {
  return db.transaction(async (tx) => {
    await tx.insert(aiKinds).values({ kind }).onConflictDoNothing();
    await tx
      .insert(aiModels)
      .values({
        kind,
        modelId: model.id,
        name: model.name,
        position: nextPosition(kind),
      })
      .onConflictDoUpdate({
        target: [aiModels.kind, aiModels.modelId],
        set: { isHidden: false, position: nextPosition(kind) },
        setWhere: eq(aiModels.isHidden, true),
      });
  });
}

function nextPosition(kind: AiModelKind) {
  return sql`(select coalesce(max(${aiModels.position}), -1) + 1 from ${aiModels} where ${aiModels.kind} = ${kind})`;
}

/** Takes a model off your list: hidden, its note and score kept for when it's added again. */
export async function removeYourModel(db: SyncDb, kind: AiModelKind, modelId: string): Promise<void> {
  await db
    .update(aiModels)
    .set({ isHidden: true })
    .where(and(eq(aiModels.kind, kind), eq(aiModels.modelId, modelId)));
}

/** The removed models of this kind by id, with their notes and scores, for the Add screen. */
export async function readRemovedModels(
  db: SyncDb,
  kind: AiModelKind,
): Promise<Map<string, { note: string | null; score: number | null }>> {
  const rows = await db
    .select({ id: aiModels.modelId, note: aiModels.note, score: aiScores.score })
    .from(aiModels)
    .leftJoin(aiScores, and(eq(aiScores.kind, aiModels.kind), eq(aiScores.modelId, aiModels.modelId)))
    .where(and(eq(aiModels.kind, kind), eq(aiModels.isHidden, true)));
  return new Map(rows.map(({ id, note, score }) => [id, { note, score }]));
}

/** Sets a model's note (null or empty takes it away). */
export async function setModelNote(db: SyncDb, kind: AiModelKind, modelId: string, note: string | null): Promise<void> {
  await db
    .update(aiModels)
    .set({ note: note || null })
    .where(and(eq(aiModels.kind, kind), eq(aiModels.modelId, modelId)));
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

// A photo still in the library: deleted ones drop out of a vision set.
const isLiveAsset = and(isNull(assets.deletedAt), isNull(assets.purgedAt));

/** The assets with these ids still in the library, once each, in `ids` order. */
export async function readLiveAssets(db: SyncDb, ids: string[]): Promise<AssetRow[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(assets)
    .where(and(inJson(assets.id, [...new Set(ids)]), isLiveAsset));
  const byId = new Map(rows.map((asset) => [asset.id, asset]));
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

/** The last vision compare's photos still in the library, in their order. */
export async function readVisionPhotos(db: SyncDb): Promise<AssetRow[]> {
  const rows = await db
    .select({ asset: assets })
    .from(aiVisionPhotos)
    .innerJoin(assets, eq(assets.id, aiVisionPhotos.assetId))
    .where(isLiveAsset)
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

/** Adds `delta` (±1, or -2 for two thumbs up taken back) to a model's score; it never goes below 0. */
export async function addScore(db: SyncDb, kind: AiModelKind, modelId: string, delta: number): Promise<void> {
  await db
    .insert(aiScores)
    .values({ kind, modelId, score: Math.max(0, delta) })
    .onConflictDoUpdate({
      target: [aiScores.kind, aiScores.modelId],
      set: { score: sql`max(0, ${aiScores.score} + ${delta})` },
    });
}
