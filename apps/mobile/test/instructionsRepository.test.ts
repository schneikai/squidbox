import { DEFAULT_INSTRUCTIONS, resolveInstructions, type InstructionKind } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { readInstructions, saveInstruction } from '../src/sync/instructionsRepository';
import { clearOutboxRows } from '../src/sync/outbox';

const USER = '6f1c1c39-6c1c-4a36-9d0e-2d6c1ad4e0f1';
const MINE = 'Write like me: short, calm, never salesy.';

// Saves against the built-in texts as the app's defaults.
const save = (db: SyncDb, kind: InstructionKind, text: string | null) =>
  saveInstruction(db, USER, kind, text, DEFAULT_INSTRUCTIONS[kind]);
const outbox = (db: SyncDb) => db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'instructions'));

describe('instructionsRepository', () => {
  it('reads nothing before the first save, which resolves to the defaults', async () => {
    const db = makeTestDb();
    expect(await readInstructions(db, USER)).toBeNull();
    expect(resolveInstructions(null, DEFAULT_INSTRUCTIONS)).toEqual(DEFAULT_INSTRUCTIONS);
  });

  it("creates the record with the user's id on the first save, sending only that kind", async () => {
    const db = makeTestDb();
    await save(db, 'writing', ` ${MINE} `);
    expect(await readInstructions(db, USER)).toMatchObject({
      id: USER,
      writing: MINE,
      visionTagging: null,
    });
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(['writing']);
    expect(resolveInstructions(await readInstructions(db, USER), DEFAULT_INSTRUCTIONS)).toEqual({
      ...DEFAULT_INSTRUCTIONS,
      writing: MINE,
    });
  });

  it('updates the same record, and a reset stores null', async () => {
    const db = makeTestDb();
    await save(db, 'writing', MINE);
    await save(db, 'visionTagging', 'Tag the trees.');
    expect(await db.select().from(schema.instructions)).toHaveLength(1);
    await clearOutboxRows(db, 'instructions', [USER]);
    await save(db, 'writing', null);
    expect(await readInstructions(db, USER)).toMatchObject({ writing: null, visionTagging: 'Tag the trees.' });
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(['writing']);
  });

  it('stores a text equal to the default as null, and writes nothing when that changes nothing', async () => {
    const db = makeTestDb();
    await save(db, 'visionTagging', DEFAULT_INSTRUCTIONS.visionTagging);
    expect(await readInstructions(db, USER)).toBeNull();
    await save(db, 'visionTagging', MINE);
    await clearOutboxRows(db, 'instructions', [USER]);
    await save(db, 'visionTagging', `${DEFAULT_INSTRUCTIONS.visionTagging}\n`);
    expect((await readInstructions(db, USER))!.visionTagging).toBeNull();
    await clearOutboxRows(db, 'instructions', [USER]);
    await save(db, 'visionTagging', null);
    expect(await outbox(db)).toHaveLength(0);
  });

  it('brings a tombstoned record back instead of inserting it again', async () => {
    const db = makeTestDb();
    await save(db, 'writing', MINE);
    await db.update(schema.instructions).set({ deletedAt: 5 }).where(eq(schema.instructions.id, USER));
    await clearOutboxRows(db, 'instructions', [USER]);
    await save(db, 'visionTagging', 'Tag the trees.');
    expect(await readInstructions(db, USER)).toMatchObject({ deletedAt: null, visionTagging: 'Tag the trees.' });
    expect(await db.select().from(schema.instructions)).toHaveLength(1);
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(expect.arrayContaining(['visionTagging', 'deletedAt']));
  });

  it("gives every account its own texts, and the app's for the kinds it hasn't changed", async () => {
    const db = makeTestDb();
    await save(db, 'writing', MINE);
    await save(db, 'moreLikeThis', 'Again, please.');
    await save(db, 'modelCheckJudge', 'Judge it: {reply}');
    const stored = await readInstructions(db, USER);
    expect(resolveInstructions(stored, DEFAULT_INSTRUCTIONS)).toEqual({
      ...DEFAULT_INSTRUCTIONS,
      writing: MINE,
      moreLikeThis: 'Again, please.',
      modelCheckJudge: 'Judge it: {reply}',
    });
    expect(resolveInstructions(null, DEFAULT_INSTRUCTIONS)).toEqual(DEFAULT_INSTRUCTIONS);
  });

  it('stores a text equal to the published default as null, and the built-in one as an override', async () => {
    const db = makeTestDb();
    const published = "Tag what you see, in the creator's words.";
    await saveInstruction(db, USER, 'visionTagging', published, published);
    expect(await readInstructions(db, USER)).toBeNull();
    await saveInstruction(db, USER, 'visionTagging', DEFAULT_INSTRUCTIONS.visionTagging, published);
    expect((await readInstructions(db, USER))!.visionTagging).toBe(DEFAULT_INSTRUCTIONS.visionTagging);
  });

  it("resolves the kinds left null to the app's published defaults", async () => {
    const db = makeTestDb();
    const defaults = { ...DEFAULT_INSTRUCTIONS, writing: 'Everyone writes like this.', moreLikeThis: 'More.' };
    await saveInstruction(db, USER, 'writing', MINE, defaults.writing);
    expect(resolveInstructions(await readInstructions(db, USER), defaults)).toEqual({ ...defaults, writing: MINE });
  });
});
