// The Verify runs an ai_admin starts from the app (POST /ai/verify/:kind/:modelId): one row per run
// in verify_runs, of which a model keeps only its latest per kind, and the job that runs Verify in
// the background, writing the result after each turn so the app can show it growing.
import { and, desc, eq, inArray, lt, type SQL } from 'drizzle-orm';
import { VERIFY_TURNS, type AiModelKind, type Instructions, type VerifyRun } from '@squidbox/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/client.js';
import { driverError } from '../db/pgError.js';
import { verifyRuns, type VerifyRunRow } from '../db/schema.js';
import { errorMessage } from '../errors.js';
import type { CatalogEntry } from './catalog.js';
import { VERIFY } from './verify.js';
import { VerifyStopped } from './verifyTurns.js';

const RESTARTED = 'The server restarted while it ran';
const STOPPED = 'The server stopped while it ran';

// A running run beats its heartbeat (updated_at) every HEARTBEAT_MS while it runs, and one whose
// heartbeat is older than STALE_MS was abandoned: its server stopped.
const HEARTBEAT_MS = 30 * 1000;
const STALE_MS = 2 * 60 * 1000;

// The runs this process runs, so a shutdown can stop them (failOwnRuns).
const ownRuns = new Set<string>();

// The row while it is still running: each write of a run applies only then, so a row stopped
// meanwhile stays stopped.
const isRunning = eq(verifyRuns.status, 'running');
const stopped = (error: string) => ({ status: 'stopped', finishedAt: new Date(), error });
const ofModel = (kind: AiModelKind, modelId: string) => and(eq(verifyRuns.kind, kind), eq(verifyRuns.modelId, modelId));

// Stops the running runs (of `where`, else all) whose heartbeat stopped: nothing runs them any more.
async function failStaleRuns(db: Db, where?: SQL): Promise<void> {
  const isStale = lt(verifyRuns.updatedAt, new Date(Date.now() - STALE_MS));
  await db
    .update(verifyRuns)
    .set(stopped(RESTARTED))
    .where(and(isRunning, isStale, where));
}

function toVerifyRun(row: VerifyRunRow): VerifyRun {
  return {
    id: row.id,
    kind: row.kind as AiModelKind,
    modelId: row.modelId,
    status: row.status as VerifyRun['status'],
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    turnsDone: row.turnsDone,
    turnsTotal: row.turnsTotal,
    result: row.result ?? null,
    error: row.error,
  };
}

/** The model's latest run of `kind`, or null before its first; an abandoned one reads stopped. */
export async function readLatestRun(db: Db, kind: AiModelKind, modelId: string): Promise<VerifyRun | null> {
  await failStaleRuns(db, ofModel(kind, modelId));
  const [row] = await db
    .select()
    .from(verifyRuns)
    .where(ofModel(kind, modelId))
    .orderBy(desc(verifyRuns.startedAt))
    .limit(1);
  return row ? toVerifyRun(row) : null;
}

// Postgres' unique_violation: another start of the same model and kind won the race.
const isUniqueViolation = (error: unknown) => driverError(error)?.code === '23505';

/**
 * A running run of the model and kind: the one already running (`isNew` false), or a new row, in
 * the same transaction as the model's older rows of that kind are deleted. One whose heartbeat
 * stopped is stopped first, so an abandoned run never blocks a new one. No Venice call here.
 */
export async function startRun(
  db: Db,
  { kind, modelId, userId }: { kind: AiModelKind; modelId: string; userId: string | null },
): Promise<{ run: VerifyRun; isNew: boolean }> {
  const running = and(ofModel(kind, modelId), isRunning);
  await failStaleRuns(db, ofModel(kind, modelId));
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(verifyRuns).where(running);
      if (current) return { run: toVerifyRun(current), isNew: false };
      await tx.delete(verifyRuns).where(ofModel(kind, modelId));
      const [row] = await tx
        .insert(verifyRuns)
        .values({ kind, modelId, status: 'running', startedBy: userId, turnsTotal: VERIFY_TURNS[kind] })
        .returning();
      return { run: toVerifyRun(row!), isNew: true };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [current] = await db.select().from(verifyRuns).where(running);
    if (!current) throw error;
    return { run: toVerifyRun(current), isNew: false };
  }
}

/**
 * Runs Verify on a row startRun made, with the instructions `instructionsAsync` reads, writing its
 * result after each turn and its heartbeat meanwhile, then `done` with the final result, or `stopped`
 * with the error's message (logged too) and, when Venice stopped answering, the result so far. Never
 * throws: the route doesn't wait.
 */
export async function runVerify(
  db: Db,
  {
    run,
    model,
    catalog,
    instructionsAsync,
    log,
  }: {
    run: Pick<VerifyRun, 'id' | 'kind'>;
    model: CatalogEntry;
    catalog: CatalogEntry[];
    instructionsAsync: () => Promise<Instructions>;
    log: FastifyBaseLogger;
  },
): Promise<void> {
  const thisRun = and(eq(verifyRuns.id, run.id), isRunning);
  ownRuns.add(run.id);
  const heartbeat = setInterval(() => {
    db.update(verifyRuns)
      .set({ updatedAt: new Date() })
      .where(thisRun)
      .catch((error: unknown) => log.error({ err: error, runId: run.id }, 'Verify heartbeat failed'));
  }, HEARTBEAT_MS);
  try {
    const result = await VERIFY[run.kind].run(model, {
      catalog,
      instructions: await instructionsAsync(),
      onTurn: async (soFar, turnsDone) => {
        await db.update(verifyRuns).set({ result: soFar, turnsDone, updatedAt: new Date() }).where(thisRun);
      },
    });
    await db.update(verifyRuns).set({ status: 'done', finishedAt: new Date(), result }).where(thisRun);
  } catch (error) {
    log.error({ err: error, runId: run.id }, 'Verify stopped');
    try {
      await db
        .update(verifyRuns)
        .set({ ...stopped(errorMessage(error)), ...(error instanceof VerifyStopped && { result: error.result }) })
        .where(thisRun);
    } catch (stopError) {
      log.error({ err: stopError, runId: run.id }, 'Verify could not be marked stopped');
    }
  } finally {
    clearInterval(heartbeat);
    ownRuns.delete(run.id);
  }
}

/** Stops every running run whose heartbeat stopped (at boot: their server stopped). */
export async function failAbandonedRuns(db: Db): Promise<void> {
  await failStaleRuns(db);
}

/** Stops the runs this process still runs (at shutdown: nothing will finish them). */
export async function failOwnRuns(db: Db): Promise<void> {
  if (ownRuns.size === 0) return;
  await db
    .update(verifyRuns)
    .set(stopped(STOPPED))
    .where(and(isRunning, inArray(verifyRuns.id, [...ownRuns])));
}
