import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import { CHECK_TURNS, resolveInstructions, type ModelCheckResult } from '@squidbox/shared';
import * as schema from '../src/db/schema.js';
import type { Db } from '../src/db/client.js';
import type { CatalogEntry } from '../src/ai/catalog.js';
import { CHECKS } from '../src/ai/modelCheck.js';
import { failAbandonedChecks, readLatestCheck, runCheck, startCheck } from '../src/ai/modelChecks.js';
import {
  readModelDefaults,
  readVerification,
  setModelDefault,
  setUncensored,
  setVerification,
} from '../src/ai/verification.js';

// The app-wide marks and check runs against Postgres (npm run test:db, on a database the migration
// seeded). Every case uses its own model ids, and afterAll deletes them; a case that changes the
// seeded defaults does it in a transaction it rolls back, so the other test files, which read the
// defaults at the same time, always see the seed.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const SEEDED = {
  writing: { regular: 'claude-sonnet-5-5', unrestricted: 'deepseek-v4-1-flash-uncensored' },
  vision: { regular: 'gemma-4-uncensored', unrestricted: 'gemma-4-uncensored' },
};
const IDS = ['test-writing-1', 'test-writing-2', 'test-writing-3', 'test-check-1', 'test-check-2'];

const RESULT: ModelCheckResult = {
  sections: [],
  passes: 0,
  fails: 0,
  unreadable: 0,
  medianSeconds: 0,
  slowestSeconds: 0,
};
const log = { error: vi.fn() } as never;
const model = { id: 'test-check-1' } as CatalogEntry;
const instructionsAsync = async () => resolveInstructions(null);

// A catalog entry as Venice lists it, labelled Uncensored or not.
const entry = (id: string, isVeniceUncensored = false) =>
  ({
    id,
    model_spec: { name: isVeniceUncensored ? 'Test Uncensored' : 'Test', traits: [] },
  }) as unknown as CatalogEntry;

const ROLLBACK = new Error('rollback');

d('the model marks and checks', () => {
  let pool: pg.Pool;
  let db: Db;

  const mark = (db: Db, kind: 'writing' | 'vision', modelId: string, isVerified = true) =>
    setVerification(db, { kind, modelId, isVerified, userId: null });

  // Runs `change` in a transaction it then rolls back: what it changes is never seen outside.
  async function rolledBack(change: (tx: Db) => Promise<void>) {
    try {
      await db.transaction(async (tx) => {
        await change(tx as unknown as Db);
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema }) as unknown as Db;
  });

  afterAll(async () => {
    await db.delete(schema.modelChecks).where(inArray(schema.modelChecks.modelId, IDS));
    await db.delete(schema.uncensoredOverrides).where(inArray(schema.uncensoredOverrides.modelId, IDS));
    await db.delete(schema.verifiedModels).where(inArray(schema.verifiedModels.modelId, IDS));
    await pool.end();
  });

  it('reads the seeded marks and defaults, each default verified', async () => {
    const { verified, overrides, defaults } = await readVerification(db);
    expect(defaults).toEqual(SEEDED);
    expect(await readModelDefaults(db)).toEqual(SEEDED);
    expect(verified.writing.has('claude-sonnet-5-5')).toBe(true);
    // the one override: the abliterated model Venice doesn't label
    expect(overrides.get('abliteration-abliterated-model-large-flash')).toBe(true);
    expect(overrides.has('claude-sonnet-5-5')).toBe(false);
    for (const kind of ['writing', 'vision'] as const) {
      expect(verified[kind].has(defaults[kind].regular)).toBe(true);
      expect(verified[kind].has(defaults[kind].unrestricted)).toBe(true);
    }
  });

  it('marks and unmarks a model, keeping who and when on a second mark', async () => {
    const rowOf = async () =>
      (await db.select().from(schema.verifiedModels).where(eq(schema.verifiedModels.modelId, 'test-writing-1')))[0];
    await mark(db, 'writing', 'test-writing-1');
    const first = await rowOf();
    await mark(db, 'writing', 'test-writing-1');
    expect((await rowOf())!.verifiedAt).toEqual(first!.verifiedAt);
    const { verified } = await readVerification(db);
    expect(verified.writing.has('test-writing-1')).toBe(true);
    expect(verified.vision.has('test-writing-1')).toBe(false);
    await mark(db, 'writing', 'test-writing-1', false);
    expect((await readVerification(db)).verified.writing.has('test-writing-1')).toBe(false);
  });

  it('sets the Uncensored override once per model, and drops it to follow Venice', async () => {
    const plain = entry('test-writing-3');
    await setUncensored(db, { entry: plain, uncensored: true, userId: null });
    expect((await readVerification(db)).overrides.get('test-writing-3')).toBe(true);
    await setUncensored(db, { entry: plain, uncensored: false, userId: null });
    expect((await readVerification(db)).overrides.get('test-writing-3')).toBe(false);
    await setUncensored(db, { entry: plain, uncensored: null, userId: null });
    expect((await readVerification(db)).overrides.has('test-writing-3')).toBe(false);
  });

  it('makes a verified model a default, and refuses an unverified or censored one', async () => {
    await rolledBack(async (tx) => {
      const plain = entry('test-writing-2');
      await expect(setModelDefault(tx, { kind: 'writing', variant: 'regular', entry: plain })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Mark the model verified first',
      });
      await mark(tx, 'writing', 'test-writing-2');
      await expect(
        setModelDefault(tx, { kind: 'writing', variant: 'unrestricted', entry: plain }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Mark the model uncensored first' });
      // Venice's label counts without an override
      await setModelDefault(tx, { kind: 'writing', variant: 'unrestricted', entry: entry('test-writing-2', true) });
      expect((await readModelDefaults(tx)).writing.unrestricted).toBe('test-writing-2');
      // and so does an override where Venice has no label
      await setUncensored(tx, { entry: plain, uncensored: true, userId: null });
      await setModelDefault(tx, { kind: 'writing', variant: 'unrestricted', entry: plain });
      await setModelDefault(tx, { kind: 'writing', variant: 'regular', entry: plain });
      expect((await readModelDefaults(tx)).writing.regular).toBe('test-writing-2');
    });
    expect(await readModelDefaults(db)).toEqual(SEEDED);
  });

  it('refuses to unmark a default, or to make an Adult content default not uncensored', async () => {
    await rolledBack(async (tx) => {
      await mark(tx, 'writing', 'test-writing-2');
      await setModelDefault(tx, { kind: 'writing', variant: 'unrestricted', entry: entry('test-writing-2', true) });
      await expect(mark(tx, 'writing', 'test-writing-2', false)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('is the default writing model;'),
      });
      const labelled = entry('test-writing-2', true);
      await expect(setUncensored(tx, { entry: labelled, uncensored: false, userId: null })).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('default writing model for Adult content'),
      });
      // following Venice while Venice no longer labels it is not uncensored either
      const unlabelled = entry('test-writing-2');
      await expect(setUncensored(tx, { entry: unlabelled, uncensored: null, userId: null })).rejects.toMatchObject({
        statusCode: 400,
      });
      await setUncensored(tx, { entry: unlabelled, uncensored: true, userId: null });
      // Postgres itself refuses deleting a default's mark
      await expect(
        tx.transaction((savepoint) =>
          savepoint
            .delete(schema.verifiedModels)
            .where(and(eq(schema.verifiedModels.kind, 'writing'), eq(schema.verifiedModels.modelId, 'test-writing-2'))),
        ),
      ).rejects.toThrow();
    });
  });

  it('throws when a default is missing, never a fallback', async () => {
    await rolledBack(async (tx) => {
      await tx
        .delete(schema.modelDefaults)
        .where(and(eq(schema.modelDefaults.kind, 'vision'), eq(schema.modelDefaults.variant, 'regular')));
      await expect(readVerification(tx)).rejects.toThrow(/vision[\s\S]*regular/);
    });
  });

  it('runs one check per model and kind at a time, and keeps only the latest', async () => {
    const first = await startCheck(db, { kind: 'writing', modelId: 'test-check-1', userId: null });
    expect(first).toMatchObject({
      isNew: true,
      check: { status: 'running', turnsDone: 0, turnsTotal: CHECK_TURNS.writing },
    });
    const again = await startCheck(db, { kind: 'writing', modelId: 'test-check-1', userId: null });
    expect(again).toEqual({ check: first.check, isNew: false });
    const vision = await startCheck(db, { kind: 'vision', modelId: 'test-check-1', userId: null });
    expect(vision.isNew).toBe(true);
    // a second running row is refused by the database itself
    await expect(
      db
        .insert(schema.modelChecks)
        .values({ kind: 'writing', modelId: 'test-check-1', status: 'running', turnsTotal: 1 }),
    ).rejects.toThrow();

    await db.update(schema.modelChecks).set({ status: 'done' }).where(eq(schema.modelChecks.id, first.check.id));
    const next = await startCheck(db, { kind: 'writing', modelId: 'test-check-1', userId: null });
    expect(next.isNew).toBe(true);
    const rows = await db
      .select()
      .from(schema.modelChecks)
      .where(and(eq(schema.modelChecks.kind, 'writing'), eq(schema.modelChecks.modelId, 'test-check-1')));
    expect(rows.map((row) => row.id)).toEqual([next.check.id]);
    expect((await readLatestCheck(db, 'writing', 'test-check-1'))!.id).toBe(next.check.id);
    expect(await readLatestCheck(db, 'writing', 'test-check-2')).toBeNull();
  });

  it('writes the result as it runs, then done', async () => {
    const { check } = await startCheck(db, { kind: 'vision', modelId: 'test-check-2', userId: null });
    const stale = new Date(Date.now() - 60 * 60 * 1000);
    await db.update(schema.modelChecks).set({ updatedAt: stale }).where(eq(schema.modelChecks.id, check.id));
    const run = vi.spyOn(CHECKS.vision, 'run').mockImplementation(async (_model, { onTurn }) => {
      await onTurn!({ ...RESULT, passes: 1 }, 1);
      // each turn written is the heartbeat
      const [row] = await db.select().from(schema.modelChecks).where(eq(schema.modelChecks.id, check.id));
      expect(row!.updatedAt.getTime()).toBeGreaterThan(stale.getTime());
      expect(await readLatestCheck(db, 'vision', 'test-check-2')).toMatchObject({
        turnsDone: 1,
        result: { passes: 1 },
      });
      return { ...RESULT, passes: 4 };
    });
    await runCheck(db, { check, model, catalog: [], instructionsAsync, log });
    run.mockRestore();
    const done = await readLatestCheck(db, 'vision', 'test-check-2');
    expect(done).toMatchObject({ status: 'done', result: { passes: 4 }, error: null });
    expect(done!.finishedAt).toEqual(expect.any(String));
  });

  it('fails a run whose check throws, and leaves a row already failed as it is', async () => {
    const { check } = await startCheck(db, { kind: 'vision', modelId: 'test-check-2', userId: null });
    const run = vi.spyOn(CHECKS.vision, 'run').mockRejectedValueOnce(new Error('The judge is gone'));
    await runCheck(db, { check, model, catalog: [], instructionsAsync, log });
    expect(await readLatestCheck(db, 'vision', 'test-check-2')).toMatchObject({
      status: 'failed',
      error: 'The judge is gone',
    });

    const restarted = await startCheck(db, { kind: 'vision', modelId: 'test-check-2', userId: null });
    run.mockImplementationOnce(async () => {
      // a machine that boots meanwhile leaves a check that is still writing turns alone
      await failAbandonedChecks(db);
      expect((await readLatestCheck(db, 'vision', 'test-check-2'))!.status).toBe('running');
      // until its turns stop coming: its server stopped
      await db
        .update(schema.modelChecks)
        .set({ updatedAt: new Date(Date.now() - 11 * 60 * 1000) })
        .where(eq(schema.modelChecks.id, restarted.check.id));
      await failAbandonedChecks(db);
      return { ...RESULT, passes: 4 };
    });
    await runCheck(db, { check: restarted.check, model, catalog: [], instructionsAsync, log });
    run.mockRestore();
    expect(await readLatestCheck(db, 'vision', 'test-check-2')).toMatchObject({
      status: 'failed',
      error: 'The server restarted during the check',
      result: null,
    });
  });
});
