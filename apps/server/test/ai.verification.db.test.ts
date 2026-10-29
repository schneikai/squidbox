import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import { resolveInstructions, type VerifyResult } from '@squidbox/shared';
import * as schema from '../src/db/schema.js';
import type { Db } from '../src/db/client.js';
import type { CatalogEntry } from '../src/ai/catalog.js';
import { VERIFY } from '../src/ai/verify.js';
import { VerifyStopped } from '../src/ai/verifyTurns.js';
import { stopAbandonedRuns, stopOwnRuns, readLatestRun, runVerify, startRun } from '../src/ai/verifyRuns.js';
import {
  readModelDefaults,
  readVerification,
  setModelDefault,
  setUncensored,
  setVerification,
} from '../src/ai/verification.js';

// The app-wide marks and Verify runs against Postgres (npm run test:db, on a database the migration
// seeded). Every case uses its own model ids, and afterAll deletes them; a case that changes the
// seeded defaults does it in a transaction it rolls back, so the other test files, which read the
// defaults at the same time, always see the seed.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const SEEDED = {
  writing: { regular: 'claude-sonnet-5-5', unrestricted: 'deepseek-v4-1-flash-uncensored' },
  vision: { regular: 'gemma-4-uncensored', unrestricted: 'gemma-4-uncensored' },
};
const IDS = ['test-writing-1', 'test-writing-2', 'test-writing-3', 'test-verify-1', 'test-verify-2'];

const RESULT: VerifyResult = {
  sections: [],
  passes: 0,
  fails: 0,
  unreadable: 0,
  medianSeconds: 0,
  slowestSeconds: 0,
};
const log = { error: vi.fn() } as never;
const model = { id: 'test-verify-1' } as CatalogEntry;
const instructionsAsync = async () => resolveInstructions(null);

const ROLLBACK = new Error('rollback');

d('the model marks and Verify runs', () => {
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
    await db.delete(schema.verifyRuns).where(inArray(schema.verifyRuns.modelId, IDS));
    await db.delete(schema.uncensoredOverrides).where(inArray(schema.uncensoredOverrides.modelId, IDS));
    await db.delete(schema.verifiedModels).where(inArray(schema.verifiedModels.modelId, IDS));
    await pool.end();
  });

  it('reads the seeded marks and defaults, each seeded default verified', async () => {
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
    const set = (uncensored: boolean | null) =>
      setUncensored(db, { modelId: 'test-writing-3', uncensored, userId: null });
    await set(true);
    expect((await readVerification(db)).overrides.get('test-writing-3')).toBe(true);
    await set(false);
    expect((await readVerification(db)).overrides.get('test-writing-3')).toBe(false);
    await set(null);
    expect((await readVerification(db)).overrides.has('test-writing-3')).toBe(false);
  });

  it('makes a model a default without changing its labels, which turn off like any other', async () => {
    await rolledBack(async (tx) => {
      await setModelDefault(tx, { kind: 'writing', variant: 'regular', modelId: 'test-writing-2' });
      await setModelDefault(tx, { kind: 'writing', variant: 'unrestricted', modelId: 'test-writing-2' });
      let verification = await readVerification(tx);
      expect(verification.defaults.writing).toEqual({ regular: 'test-writing-2', unrestricted: 'test-writing-2' });
      expect(verification.verified.writing.has('test-writing-2')).toBe(false);
      expect(verification.overrides.has('test-writing-2')).toBe(false);
      // a default's Verified and Unrestricted turn off
      await mark(tx, 'writing', SEEDED.writing.unrestricted, false);
      await setUncensored(tx, { modelId: SEEDED.writing.unrestricted, uncensored: false, userId: null });
      verification = await readVerification(tx);
      expect(verification.verified.writing.has(SEEDED.writing.unrestricted)).toBe(false);
      expect(verification.overrides.get(SEEDED.writing.unrestricted)).toBe(false);
      expect(verification.defaults.writing.unrestricted).toBe('test-writing-2');
    });
    expect(await readModelDefaults(db)).toEqual(SEEDED);
  });

  it('throws when a default is missing, never a fallback', async () => {
    await rolledBack(async (tx) => {
      await tx
        .delete(schema.modelDefaults)
        .where(and(eq(schema.modelDefaults.kind, 'vision'), eq(schema.modelDefaults.variant, 'regular')));
      await expect(readVerification(tx)).rejects.toThrow(/vision[\s\S]*regular/);
    });
  });

  it('runs one Verify per model and kind at a time, and keeps only the latest', async () => {
    const first = await startRun(db, { kind: 'writing', modelId: 'test-verify-1', userId: null });
    expect(first).toMatchObject({
      isNew: true,
      run: { status: 'running', turnsDone: 0, turnsTotal: 21 },
    });
    const again = await startRun(db, { kind: 'writing', modelId: 'test-verify-1', userId: null });
    expect(again).toEqual({ run: first.run, isNew: false });
    const vision = await startRun(db, { kind: 'vision', modelId: 'test-verify-1', userId: null });
    expect(vision.isNew).toBe(true);
    // a second running row is refused by the database itself
    await expect(
      db
        .insert(schema.verifyRuns)
        .values({ kind: 'writing', modelId: 'test-verify-1', status: 'running', turnsTotal: 1 }),
    ).rejects.toThrow();

    await db.update(schema.verifyRuns).set({ status: 'done' }).where(eq(schema.verifyRuns.id, first.run.id));
    const next = await startRun(db, { kind: 'writing', modelId: 'test-verify-1', userId: null });
    expect(next.isNew).toBe(true);
    const rows = await db
      .select()
      .from(schema.verifyRuns)
      .where(and(eq(schema.verifyRuns.kind, 'writing'), eq(schema.verifyRuns.modelId, 'test-verify-1')));
    expect(rows.map((row) => row.id)).toEqual([next.run.id]);
    expect((await readLatestRun(db, 'writing', 'test-verify-1'))!.id).toBe(next.run.id);
    expect(await readLatestRun(db, 'writing', 'test-verify-2')).toBeNull();
  });

  it('writes the result as it runs, then done', async () => {
    const { run: started } = await startRun(db, { kind: 'vision', modelId: 'test-verify-2', userId: null });
    const stale = new Date(Date.now() - 60 * 60 * 1000);
    await db.update(schema.verifyRuns).set({ updatedAt: stale }).where(eq(schema.verifyRuns.id, started.id));
    const run = vi.spyOn(VERIFY.vision, 'run').mockImplementation(async (_model, { onTurn }) => {
      await onTurn!({ ...RESULT, passes: 1 }, 1);
      // each turn written is the heartbeat
      const [row] = await db.select().from(schema.verifyRuns).where(eq(schema.verifyRuns.id, started.id));
      expect(row!.updatedAt.getTime()).toBeGreaterThan(stale.getTime());
      expect(await readLatestRun(db, 'vision', 'test-verify-2')).toMatchObject({
        turnsDone: 1,
        result: { passes: 1 },
      });
      return { ...RESULT, passes: 4 };
    });
    await runVerify(db, { run: started, model, catalog: [], instructionsAsync, log });
    run.mockRestore();
    const done = await readLatestRun(db, 'vision', 'test-verify-2');
    expect(done).toMatchObject({ status: 'done', result: { passes: 4 }, error: null });
    expect(done!.finishedAt).toEqual(expect.any(String));
  });

  it('stops a run whose Verify throws, and leaves a row already stopped as it is', async () => {
    const { run: started } = await startRun(db, { kind: 'vision', modelId: 'test-verify-2', userId: null });
    const run = vi.spyOn(VERIFY.vision, 'run').mockRejectedValueOnce(new Error('The judge is gone'));
    await runVerify(db, { run: started, model, catalog: [], instructionsAsync, log });
    expect(await readLatestRun(db, 'vision', 'test-verify-2')).toMatchObject({
      status: 'stopped',
      error: 'The judge is gone',
    });

    const restarted = await startRun(db, { kind: 'vision', modelId: 'test-verify-2', userId: null });
    run.mockImplementationOnce(async () => {
      // a machine that boots meanwhile leaves a run that is still writing turns alone
      await stopAbandonedRuns(db);
      expect((await readLatestRun(db, 'vision', 'test-verify-2'))!.status).toBe('running');
      // until its turns stop coming: its server stopped
      await db
        .update(schema.verifyRuns)
        .set({ updatedAt: new Date(Date.now() - 11 * 60 * 1000) })
        .where(eq(schema.verifyRuns.id, restarted.run.id));
      await stopAbandonedRuns(db);
      return { ...RESULT, passes: 4 };
    });
    await runVerify(db, { run: restarted.run, model, catalog: [], instructionsAsync, log });
    run.mockRestore();
    expect(await readLatestRun(db, 'vision', 'test-verify-2')).toMatchObject({
      status: 'stopped',
      error: 'The server restarted while it ran',
      result: null,
    });
  });

  it('stops a run when Venice stops answering, with the turns before', async () => {
    const { run: started } = await startRun(db, { kind: 'writing', modelId: 'test-verify-1', userId: null });
    const partial = { ...RESULT, passes: 7 };
    const run = vi
      .spyOn(VERIFY.writing, 'run')
      .mockRejectedValueOnce(new VerifyStopped('Venice is down for the test', partial));
    await runVerify(db, { run: started, model, catalog: [], instructionsAsync, log });
    run.mockRestore();
    const stopped = await readLatestRun(db, 'writing', 'test-verify-1');
    expect(stopped).toMatchObject({ status: 'stopped', error: 'Venice is down for the test', result: partial });
    expect(stopped!.finishedAt).toEqual(expect.any(String));
  });

  it('reads and restarts a run whose heartbeat stopped as stopped, so it never blocks a new one', async () => {
    const { run: started } = await startRun(db, { kind: 'writing', modelId: 'test-verify-2', userId: null });
    const backdate = (id: string) =>
      db
        .update(schema.verifyRuns)
        .set({ updatedAt: new Date(Date.now() - 3 * 60 * 1000) })
        .where(eq(schema.verifyRuns.id, id));
    await backdate(started.id);
    expect(await readLatestRun(db, 'writing', 'test-verify-2')).toMatchObject({
      id: started.id,
      status: 'stopped',
      error: 'The server restarted while it ran',
    });
    const next = await startRun(db, { kind: 'writing', modelId: 'test-verify-2', userId: null });
    expect(next.isNew).toBe(true);
    // a stale row that is still running when a start comes in is stopped and replaced
    await backdate(next.run.id);
    const third = await startRun(db, { kind: 'writing', modelId: 'test-verify-2', userId: null });
    expect(third.isNew).toBe(true);
    expect(third.run.id).not.toBe(next.run.id);
  });

  it("stops this process's own running runs at shutdown", async () => {
    const { run: started } = await startRun(db, { kind: 'writing', modelId: 'test-verify-1', userId: null });
    const run = vi.spyOn(VERIFY.writing, 'run').mockImplementationOnce(async () => {
      await stopOwnRuns(db);
      return RESULT;
    });
    await runVerify(db, { run: started, model, catalog: [], instructionsAsync, log });
    run.mockRestore();
    expect(await readLatestRun(db, 'writing', 'test-verify-1')).toMatchObject({
      status: 'stopped',
      error: 'The server stopped while it ran',
    });
  });
});
