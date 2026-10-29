import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { clearPicksEqualTo, pickDefault, readChosenModels } from '../src/sync/modelChoicesRepository';

const USER = '6f1c1c39-6c1c-4a36-9d0e-2d6c1ad4e0f1';
const kimi = { id: 'kimi-k3', name: 'Kimi K3' };
const grok = { id: 'grok-4-7', name: 'Grok 4.7' };
const PUBLISHED = 'claude-sonnet-5-5';
const NONE = { writingModel: null, visionModel: null, writingUncensoredModel: null, visionUncensoredModel: null };

const outbox = (db: SyncDb) => db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'model_choices'));

describe('modelChoicesRepository', () => {
  it('reads no pick before the first one', async () => {
    expect(await readChosenModels(makeTestDb(), USER)).toEqual(NONE);
  });

  it("picks per kind and variant in the user's record, sending only that field", async () => {
    const db = makeTestDb();
    await pickDefault(db, USER, 'writing', 'unrestricted', { ...kimi, score: 3 } as typeof kimi, PUBLISHED);
    expect(await readChosenModels(db, USER)).toEqual({ ...NONE, writingUncensoredModel: kimi });
    expect(await db.select().from(schema.modelChoices)).toMatchObject([{ id: USER }]);
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(['writingUncensoredModel']);
  });

  it('changes a pick, and stores null for null or a pick equal to the published default', async () => {
    const db = makeTestDb();
    await pickDefault(db, USER, 'vision', 'regular', kimi, PUBLISHED);
    await pickDefault(db, USER, 'vision', 'regular', grok, PUBLISHED);
    expect((await readChosenModels(db, USER)).visionModel).toEqual(grok);
    await pickDefault(db, USER, 'vision', 'regular', null, PUBLISHED);
    expect((await readChosenModels(db, USER)).visionModel).toBeNull();
    await pickDefault(db, USER, 'vision', 'regular', grok, PUBLISHED);
    await pickDefault(db, USER, 'vision', 'regular', { id: PUBLISHED, name: 'Claude Sonnet 5.5' }, PUBLISHED);
    expect((await readChosenModels(db, USER)).visionModel).toBeNull();
  });

  it('clears only the picks equal to the published defaults, of that kind', async () => {
    const db = makeTestDb();
    await pickDefault(db, USER, 'writing', 'regular', kimi, PUBLISHED);
    await pickDefault(db, USER, 'writing', 'unrestricted', grok, PUBLISHED);
    await pickDefault(db, USER, 'vision', 'regular', kimi, PUBLISHED);
    await clearPicksEqualTo(db, USER, 'writing', { regular: kimi.id, unrestricted: 'venice-uncensored-1-2' });
    expect(await readChosenModels(db, USER)).toEqual({
      ...NONE,
      writingUncensoredModel: grok,
      visionModel: kimi,
    });
  });
});
