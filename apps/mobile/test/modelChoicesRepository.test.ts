import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { readChosenModels, setChosenModel } from '../src/sync/modelChoicesRepository';

const USER = '6f1c1c39-6c1c-4a36-9d0e-2d6c1ad4e0f1';
const kimi = { id: 'kimi-k3', name: 'Kimi K3' };
const grok = { id: 'grok-4-7', name: 'Grok 4.7' };

const outbox = (db: SyncDb) => db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'model_choices'));

describe('modelChoicesRepository', () => {
  it('reads no choice before the first one', async () => {
    expect(await readChosenModels(makeTestDb(), USER)).toEqual({ writing: null, vision: null });
  });

  it("chooses per kind in the user's record, sending only that kind", async () => {
    const db = makeTestDb();
    await setChosenModel(db, USER, 'writing', { ...kimi, score: 3 } as typeof kimi);
    expect(await readChosenModels(db, USER)).toEqual({ writing: kimi, vision: null });
    expect(await db.select().from(schema.modelChoices)).toMatchObject([{ id: USER }]);
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(['writingModel']);
  });

  it('changes a choice and goes back to the default with null', async () => {
    const db = makeTestDb();
    await setChosenModel(db, USER, 'vision', kimi);
    await setChosenModel(db, USER, 'vision', grok);
    expect((await readChosenModels(db, USER)).vision).toEqual(grok);
    await setChosenModel(db, USER, 'vision', null);
    expect((await readChosenModels(db, USER)).vision).toBeNull();
  });
});
