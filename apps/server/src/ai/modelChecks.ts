// The model check runs an ai_admin starts from the app (POST /ai/checks/:kind/:modelId): one row per
// run in model_checks, of which a model keeps only its latest per kind, and the job that runs the
// check in the background, writing the result after each turn so the app can show it growing.
import { and, desc, eq } from 'drizzle-orm';
import type { AiModelKind, Instructions, ModelCheck } from '@squidbox/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/client.js';
import { modelChecks, type ModelCheckRow } from '../db/schema.js';
import type { CatalogEntry } from './catalog.js';
import { CHECKS } from './modelCheck.js';

const RESTARTED = 'The server restarted during the check';

function toModelCheck(row: ModelCheckRow): ModelCheck {
  return {
    id: row.id,
    kind: row.kind as AiModelKind,
    modelId: row.modelId,
    status: row.status as ModelCheck['status'],
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    turnsDone: row.turnsDone,
    turnsTotal: row.turnsTotal,
    result: row.result ?? null,
    error: row.error,
  };
}

/** The model's latest check of `kind`, or null before its first. */
export async function readLatestCheck(db: Db, kind: AiModelKind, modelId: string): Promise<ModelCheck | null> {
  const [row] = await db
    .select()
    .from(modelChecks)
    .where(and(eq(modelChecks.kind, kind), eq(modelChecks.modelId, modelId)))
    .orderBy(desc(modelChecks.startedAt))
    .limit(1);
  return row ? toModelCheck(row) : null;
}

// Postgres' unique_violation: another start of the same model and kind won the race.
const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === '23505';

/**
 * A running check of the model and kind: the one already running (`isNew` false), or a new row, in
 * the same transaction as the model's older rows of that kind are deleted. No Venice call here.
 */
export async function startCheck(
  db: Db,
  { kind, modelId, userId }: { kind: AiModelKind; modelId: string; userId: string | null },
): Promise<{ check: ModelCheck; isNew: boolean }> {
  const running = and(eq(modelChecks.kind, kind), eq(modelChecks.modelId, modelId), eq(modelChecks.status, 'running'));
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(modelChecks).where(running);
      if (current) return { check: toModelCheck(current), isNew: false };
      await tx.delete(modelChecks).where(and(eq(modelChecks.kind, kind), eq(modelChecks.modelId, modelId)));
      const [row] = await tx
        .insert(modelChecks)
        .values({ kind, modelId, status: 'running', startedBy: userId, turnsTotal: CHECKS[kind].turnCount })
        .returning();
      return { check: toModelCheck(row!), isNew: true };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [current] = await db.select().from(modelChecks).where(running);
    if (!current) throw error;
    return { check: toModelCheck(current), isNew: false };
  }
}

/**
 * Runs the check of a row startCheck made, writing its result after each turn, then `done` with the
 * final result, or `failed` with the error's message (logged too). Each write applies only while the
 * row is still running, so one failAbandonedChecks failed stays failed.
 */
export async function runCheck(
  db: Db,
  {
    check,
    model,
    catalog,
    instructions,
    log,
  }: {
    check: Pick<ModelCheck, 'id' | 'kind'>;
    model: CatalogEntry;
    catalog: CatalogEntry[];
    instructions: Instructions;
    log: FastifyBaseLogger;
  },
): Promise<void> {
  const thisRun = and(eq(modelChecks.id, check.id), eq(modelChecks.status, 'running'));
  try {
    const result = await CHECKS[check.kind].run(model, {
      catalog,
      instructions,
      onTurn: async (soFar, turnsDone) => {
        await db.update(modelChecks).set({ result: soFar, turnsDone }).where(thisRun);
      },
    });
    await db.update(modelChecks).set({ status: 'done', finishedAt: new Date(), result }).where(thisRun);
  } catch (error) {
    log.error({ err: error, checkId: check.id }, 'Model check failed');
    await failCheck(db, check.id, error instanceof Error ? error.message : String(error));
  }
}

/** Marks a running check failed with `error`. */
export async function failCheck(db: Db, id: string, error: string): Promise<void> {
  await db
    .update(modelChecks)
    .set({ status: 'failed', finishedAt: new Date(), error })
    .where(and(eq(modelChecks.id, id), eq(modelChecks.status, 'running')));
}

/** Fails every running check: at boot, nothing runs them any more. */
export async function failAbandonedChecks(db: Db): Promise<void> {
  await db
    .update(modelChecks)
    .set({ status: 'failed', finishedAt: new Date(), error: RESTARTED })
    .where(eq(modelChecks.status, 'running'));
}
