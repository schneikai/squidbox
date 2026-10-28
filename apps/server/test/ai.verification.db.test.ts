import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import { resolveInstructions, type ModelCheckResult } from '@squidbox/shared';
import * as schema from '../src/db/schema.js';
import type { Db } from '../src/db/client.js';
import type { CatalogEntry } from '../src/ai/catalog.js';
import { CHECKS } from '../src/ai/modelCheck.js';
import { failAbandonedChecks, readLatestCheck, runCheck, startCheck } from '../src/ai/modelChecks.js';
import { readModelDefaults, readVerification, setModelDefault, setVerification } from '../src/ai/verification.js';

// The app-wide marks and check runs against Postgres (npm run test:db, on the preview database the
// migration seeded). Every case uses its own model ids, and afterAll deletes them and puts the seeded
// defaults back, so the seed stays as it was.
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

d('the model marks and checks', () => {
  let pool: pg.Pool;
  let db: Db;

  const mark = (
    kind: 'writing' | 'vision',
    modelId: string,
    isUnrestricted: boolean | null = null,
    isVeniceUncensored = false,
  ) => setVerification(db, { kind, modelId, isVerified: true, isUnrestricted, isVeniceUncensored, userId: null });

  async function restoreDefaults() {
    for (const kind of ['writing', 'vision'] as const) {
      for (const variant of ['regular', 'unrestricted'] as const) {
        await db
          .insert(schema.modelDefaults)
          .values({ kind, variant, modelId: SEEDED[kind][variant] })
          .onConflictDoUpdate({
            target: [schema.modelDefaults.kind, schema.modelDefaults.variant],
            set: { modelId: SEEDED[kind][variant] },
          });
      }
    }
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema }) as unknown as Db;
  });

  afterAll(async () => {
    await restoreDefaults();
    await db.delete(schema.modelChecks).where(inArray(schema.modelChecks.modelId, IDS));
    await db.delete(schema.verifiedModels).where(inArray(schema.verifiedModels.modelId, IDS));
    await pool.end();
  });

  it('reads the seeded marks and defaults, each default verified and the Adult one uncensored', async () => {
    const { verified, defaults } = await readVerification(db);
    expect(defaults).toEqual(SEEDED);
    expect(await readModelDefaults(db)).toEqual(SEEDED);
    expect(verified.writing.get('claude-sonnet-5-5')).toEqual({ unrestricted: null });
    expect(verified.writing.get('abliteration-abliterated-model-large-flash')).toEqual({ unrestricted: true });
    for (const kind of ['writing', 'vision'] as const) {
      expect(verified[kind].has(defaults[kind].regular)).toBe(true);
      expect(verified[kind].has(defaults[kind].unrestricted)).toBe(true);
    }
  });

  it('marks and unmarks a model, keeping who and when on a second mark', async () => {
    await mark('writing', 'test-writing-1');
    const first = await db
      .select()
      .from(schema.verifiedModels)
      .where(eq(schema.verifiedModels.modelId, 'test-writing-1'));
    await mark('writing', 'test-writing-1', true);
    const [second] = await db
      .select()
      .from(schema.verifiedModels)
      .where(eq(schema.verifiedModels.modelId, 'test-writing-1'));
    expect(second!.verifiedAt).toEqual(first[0]!.verifiedAt);
    expect(second!.unrestricted).toBe(true);
    await mark('writing', 'test-writing-1', null);
    expect((await readVerification(db)).verified.writing.get('test-writing-1')).toEqual({ unrestricted: null });
    expect((await readVerification(db)).verified.vision.has('test-writing-1')).toBe(false);
    await setVerification(db, {
      kind: 'writing',
      modelId: 'test-writing-1',
      isVerified: false,
      isUnrestricted: null,
      userId: null,
    });
    expect((await readVerification(db)).verified.writing.has('test-writing-1')).toBe(false);
  });

  it('refuses an override on a model it does not verify', async () => {
    await expect(
      setVerification(db, {
        kind: 'writing',
        modelId: 'test-writing-3',
        isVerified: false,
        isUnrestricted: true,
        userId: null,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('makes a verified model a default, and refuses an unverified or censored one', async () => {
    await expect(
      setModelDefault(db, {
        kind: 'writing',
        variant: 'regular',
        modelId: 'test-writing-2',
        isVeniceUncensored: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Mark the model verified first' });
    await mark('writing', 'test-writing-2');
    await expect(
      setModelDefault(db, {
        kind: 'writing',
        variant: 'unrestricted',
        modelId: 'test-writing-2',
        isVeniceUncensored: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Mark the model uncensored first' });
    // Venice's label counts while the mark follows it
    await setModelDefault(db, {
      kind: 'writing',
      variant: 'unrestricted',
      modelId: 'test-writing-2',
      isVeniceUncensored: true,
    });
    expect((await readModelDefaults(db)).writing.unrestricted).toBe('test-writing-2');
    await setModelDefault(db, {
      kind: 'writing',
      variant: 'regular',
      modelId: 'test-writing-2',
      isVeniceUncensored: true,
    });
    expect((await readModelDefaults(db)).writing.regular).toBe('test-writing-2');
  });

  it('refuses to unmark a default, or to make the Adult content default not uncensored', async () => {
    // test-writing-2 is both writing defaults now (the case above)
    await expect(
      setVerification(db, {
        kind: 'writing',
        modelId: 'test-writing-2',
        isVerified: false,
        isUnrestricted: null,
        userId: null,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('is the default writing model;') });
    await expect(mark('writing', 'test-writing-2', false, true)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('for Adult content'),
    });
    // following Venice while Venice no longer labels it is not uncensored either
    await expect(mark('writing', 'test-writing-2', null, false)).rejects.toMatchObject({ statusCode: 400 });
    await mark('writing', 'test-writing-2', true, false);
    // Postgres itself refuses deleting a default's mark
    await expect(
      db
        .delete(schema.verifiedModels)
        .where(and(eq(schema.verifiedModels.kind, 'writing'), eq(schema.verifiedModels.modelId, 'test-writing-2'))),
    ).rejects.toThrow();
    await restoreDefaults();
  });

  it('throws when a default is missing, never a fallback', async () => {
    await db
      .delete(schema.modelDefaults)
      .where(and(eq(schema.modelDefaults.kind, 'vision'), eq(schema.modelDefaults.variant, 'regular')));
    try {
      await expect(readVerification(db)).rejects.toThrow('No default vision model for regular');
    } finally {
      await restoreDefaults();
    }
  });

  it('runs one check per model and kind at a time, and keeps only the latest', async () => {
    const first = await startCheck(db, { kind: 'writing', modelId: 'test-check-1', userId: null });
    expect(first).toMatchObject({
      isNew: true,
      check: { status: 'running', turnsDone: 0, turnsTotal: CHECKS.writing.turnCount },
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
    const run = vi.spyOn(CHECKS.vision, 'run').mockImplementation(async (_model, { onTurn }) => {
      await onTurn!({ ...RESULT, passes: 1 }, 1);
      expect(await readLatestCheck(db, 'vision', 'test-check-2')).toMatchObject({
        turnsDone: 1,
        result: { passes: 1 },
      });
      return { ...RESULT, passes: 4 };
    });
    await runCheck(db, { check, model, catalog: [], instructions: resolveInstructions(null), log });
    run.mockRestore();
    const done = await readLatestCheck(db, 'vision', 'test-check-2');
    expect(done).toMatchObject({ status: 'done', result: { passes: 4 }, error: null });
    expect(done!.finishedAt).toEqual(expect.any(String));
  });

  it('fails a run whose check throws, and leaves a row already failed as it is', async () => {
    const { check } = await startCheck(db, { kind: 'vision', modelId: 'test-check-2', userId: null });
    const run = vi.spyOn(CHECKS.vision, 'run').mockRejectedValueOnce(new Error('The judge is gone'));
    await runCheck(db, { check, model, catalog: [], instructions: resolveInstructions(null), log });
    expect(await readLatestCheck(db, 'vision', 'test-check-2')).toMatchObject({
      status: 'failed',
      error: 'The judge is gone',
    });

    const restarted = await startCheck(db, { kind: 'vision', modelId: 'test-check-2', userId: null });
    run.mockImplementationOnce(async () => {
      await failAbandonedChecks(db); // a new machine booted meanwhile
      return { ...RESULT, passes: 4 };
    });
    await runCheck(db, { check: restarted.check, model, catalog: [], instructions: resolveInstructions(null), log });
    run.mockRestore();
    expect(await readLatestCheck(db, 'vision', 'test-check-2')).toMatchObject({
      status: 'failed',
      error: 'The server restarted during the check',
      result: null,
    });
  });
});
