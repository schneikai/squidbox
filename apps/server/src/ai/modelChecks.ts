// The model check runs an ai_admin starts from the app (POST /ai/checks/:kind/:modelId): one row per
// run in model_checks, of which a model keeps only its latest per kind, and the job that runs the
// check in the background, writing the result after each turn so the app can show it growing.
import { and, desc, eq, inArray, lt, type SQL } from 'drizzle-orm';
import { CHECK_TURNS, type AiModelKind, type Instructions, type ModelCheck } from '@squidbox/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/client.js';
import { driverError } from '../db/pgError.js';
import { modelChecks, type ModelCheckRow } from '../db/schema.js';
import { errorMessage } from '../errors.js';
import type { CatalogEntry } from './catalog.js';
import { CHECKS } from './modelCheck.js';

const RESTARTED = 'The server restarted during the check';
const STOPPED = 'The server stopped during the check';

// A running check beats its heartbeat (updated_at) every HEARTBEAT_MS while it runs, and one whose
// heartbeat is older than STALE_MS was abandoned: its server stopped.
const HEARTBEAT_MS = 30 * 1000;
const STALE_MS = 2 * 60 * 1000;

// The checks this process runs, so a shutdown can fail them (failOwnChecks).
const ownChecks = new Set<string>();

// The row while it is still running: each write of a run applies only then, so a row failed meanwhile
// stays failed.
const isRunning = eq(modelChecks.status, 'running');
const failed = (error: string) => ({ status: 'failed', finishedAt: new Date(), error });
const ofModel = (kind: AiModelKind, modelId: string) =>
  and(eq(modelChecks.kind, kind), eq(modelChecks.modelId, modelId));

// Fails the running checks (of `where`, else all) whose heartbeat stopped: nothing runs them any more.
async function failStaleChecks(db: Db, where?: SQL): Promise<void> {
  const isStale = lt(modelChecks.updatedAt, new Date(Date.now() - STALE_MS));
  await db
    .update(modelChecks)
    .set(failed(RESTARTED))
    .where(and(isRunning, isStale, where));
}

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

/** The model's latest check of `kind`, or null before its first; an abandoned one reads failed. */
export async function readLatestCheck(db: Db, kind: AiModelKind, modelId: string): Promise<ModelCheck | null> {
  await failStaleChecks(db, ofModel(kind, modelId));
  const [row] = await db
    .select()
    .from(modelChecks)
    .where(ofModel(kind, modelId))
    .orderBy(desc(modelChecks.startedAt))
    .limit(1);
  return row ? toModelCheck(row) : null;
}

// Postgres' unique_violation: another start of the same model and kind won the race.
const isUniqueViolation = (error: unknown) => driverError(error)?.code === '23505';

/**
 * A running check of the model and kind: the one already running (`isNew` false), or a new row, in
 * the same transaction as the model's older rows of that kind are deleted. One whose heartbeat
 * stopped is failed first, so an abandoned check never blocks a new one. No Venice call here.
 */
export async function startCheck(
  db: Db,
  { kind, modelId, userId }: { kind: AiModelKind; modelId: string; userId: string | null },
): Promise<{ check: ModelCheck; isNew: boolean }> {
  const running = and(ofModel(kind, modelId), isRunning);
  await failStaleChecks(db, ofModel(kind, modelId));
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(modelChecks).where(running);
      if (current) return { check: toModelCheck(current), isNew: false };
      await tx.delete(modelChecks).where(ofModel(kind, modelId));
      const [row] = await tx
        .insert(modelChecks)
        .values({ kind, modelId, status: 'running', startedBy: userId, turnsTotal: CHECK_TURNS[kind] })
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
 * Runs the check of a row startCheck made, with the instructions `instructionsAsync` reads, writing
 * its result after each turn and its heartbeat meanwhile, then `done` with the final result, or
 * `failed` with the error's message (logged too). Never throws: the route doesn't wait.
 */
export async function runCheck(
  db: Db,
  {
    check,
    model,
    catalog,
    instructionsAsync,
    log,
  }: {
    check: Pick<ModelCheck, 'id' | 'kind'>;
    model: CatalogEntry;
    catalog: CatalogEntry[];
    instructionsAsync: () => Promise<Instructions>;
    log: FastifyBaseLogger;
  },
): Promise<void> {
  const thisRun = and(eq(modelChecks.id, check.id), isRunning);
  ownChecks.add(check.id);
  const heartbeat = setInterval(() => {
    db.update(modelChecks)
      .set({ updatedAt: new Date() })
      .where(thisRun)
      .catch((error: unknown) => log.error({ err: error, checkId: check.id }, 'Model check heartbeat failed'));
  }, HEARTBEAT_MS);
  try {
    const result = await CHECKS[check.kind].run(model, {
      catalog,
      instructions: await instructionsAsync(),
      onTurn: async (soFar, turnsDone) => {
        await db.update(modelChecks).set({ result: soFar, turnsDone, updatedAt: new Date() }).where(thisRun);
      },
    });
    await db.update(modelChecks).set({ status: 'done', finishedAt: new Date(), result }).where(thisRun);
  } catch (error) {
    log.error({ err: error, checkId: check.id }, 'Model check failed');
    try {
      await db
        .update(modelChecks)
        .set(failed(errorMessage(error)))
        .where(thisRun);
    } catch (failError) {
      log.error({ err: failError, checkId: check.id }, 'Model check could not be marked failed');
    }
  } finally {
    clearInterval(heartbeat);
    ownChecks.delete(check.id);
  }
}

/** Fails every running check whose heartbeat stopped (at boot: their server stopped). */
export async function failAbandonedChecks(db: Db): Promise<void> {
  await failStaleChecks(db);
}

/** Fails the checks this process still runs (at shutdown: nothing will finish them). */
export async function failOwnChecks(db: Db): Promise<void> {
  if (ownChecks.size === 0) return;
  await db
    .update(modelChecks)
    .set(failed(STOPPED))
    .where(and(isRunning, inArray(modelChecks.id, [...ownChecks])));
}
