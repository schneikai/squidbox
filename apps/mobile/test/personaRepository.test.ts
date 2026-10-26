import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { clearOutboxRows } from '../src/sync/outbox';
import { EMPTY_PERSONA, readPersona, savePersona } from '../src/sync/personaRepository';

const USER = '6f1c1c39-6c1c-4a36-9d0e-2d6c1ad4e0f1';
const filled = {
  aboutYou: 'Gym guy from Berlin.',
  contentTags: ['gym', 'pov'],
  tone: 'Short and cocky.',
  useEmoji: true,
  rules: ['Never use hashtags'],
};

const outbox = (db: SyncDb) => db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'personas'));

describe('personaRepository', () => {
  it('reads nothing before the first save', async () => {
    expect(await readPersona(makeTestDb(), USER)).toBeNull();
  });

  it("creates the persona with the user's id on the first save", async () => {
    const db = makeTestDb();
    await savePersona(db, USER, filled);
    expect(await readPersona(db, USER)).toMatchObject({ id: USER, deletedAt: null, ...filled });
    expect(await outbox(db)).toHaveLength(1);
  });

  it('updates the same record on a second save', async () => {
    const db = makeTestDb();
    await savePersona(db, USER, EMPTY_PERSONA);
    await savePersona(db, USER, filled);
    expect(await db.select().from(schema.personas)).toHaveLength(1);
    expect(await readPersona(db, USER)).toMatchObject(filled);
  });

  it('sends only the fields that changed, so an untouched list keeps its clock', async () => {
    const db = makeTestDb();
    await savePersona(db, USER, filled);
    await clearOutboxRows(db, 'personas', [USER]);
    // New arrays with the same content, as the screen's draft holds them.
    await savePersona(db, USER, { ...filled, aboutYou: 'Couple from Austin.', rules: [...filled.rules] });
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(['aboutYou']);
    expect((await readPersona(db, USER))!.aboutYou).toBe('Couple from Austin.');
  });

  it('writes nothing when nothing changed', async () => {
    const db = makeTestDb();
    await savePersona(db, USER, filled);
    const before = await readPersona(db, USER);
    await clearOutboxRows(db, 'personas', [USER]);
    await savePersona(db, USER, { ...filled, contentTags: [...filled.contentTags] });
    expect(await outbox(db)).toHaveLength(0);
    expect((await readPersona(db, USER))!.updatedAt).toBe(before!.updatedAt);
  });

  it('sends only the changed fields on the first save, so it never clobbers a persona not pulled yet', async () => {
    const db = makeTestDb();
    await savePersona(db, USER, { tone: 'Short.' });
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(['tone']);
    expect(await readPersona(db, USER)).toMatchObject({ ...EMPTY_PERSONA, tone: 'Short.' });
  });

  it('writes nothing for no changes', async () => {
    const db = makeTestDb();
    await savePersona(db, USER, {});
    expect(await readPersona(db, USER)).toBeNull();
  });
});
