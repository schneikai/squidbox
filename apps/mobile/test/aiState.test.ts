import { describe, expect, it } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import {
  addScore,
  addYourModel,
  readChosenModel,
  readScores,
  readVisionPhotoIds,
  readWritingPrompt,
  readYourModels,
  removeYourModel,
  seedYourModels,
  setChosenModel,
  setVisionPhotoIds,
  setWritingPrompt,
} from '../src/features/model-compare/aiState';
import * as schema from '../src/sync/db/schema';

const kimi = { id: 'kimi-k3', name: 'Kimi K3' };
const grok = { id: 'grok-4-7', name: 'Grok 4.7' };

describe('aiState', () => {
  it('reads nothing before the first write', async () => {
    const db = makeTestDb();
    expect(await readChosenModel(db, 'writing')).toBeNull();
    expect(await readYourModels(db, 'writing')).toBeNull();
    expect(await readWritingPrompt(db)).toBeNull();
    expect(await readVisionPhotoIds(db)).toBeNull();
    expect(await readScores(db, 'writing')).toEqual({});
  });

  it('round-trips the choice, prompt and photo set, per kind', async () => {
    const db = makeTestDb();
    await setChosenModel(db, 'writing', { ...kimi, isUncensored: false } as typeof kimi);
    await setWritingPrompt(db, 'Write');
    await setVisionPhotoIds(db, ['a1', 'a2']);
    expect(await readChosenModel(db, 'writing')).toEqual(kimi);
    expect(await readChosenModel(db, 'vision')).toBeNull();
    expect(await readWritingPrompt(db)).toBe('Write');
    expect(await readVisionPhotoIds(db)).toEqual(['a1', 'a2']);
  });

  it('seeds your models once, even when they were all removed since', async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    expect(await readYourModels(db, 'writing')).toEqual([kimi, grok]);
    await removeYourModel(db, 'writing', kimi.id);
    await removeYourModel(db, 'writing', grok.id);
    await seedYourModels(db, 'writing', [kimi, grok]);
    expect(await readYourModels(db, 'writing')).toEqual([]);
  });

  it('adds a model at the end once, and removing it keeps its score and clears the choice', async () => {
    const db = makeTestDb();
    await addYourModel(db, 'vision', kimi);
    await addYourModel(db, 'vision', grok);
    await addYourModel(db, 'vision', kimi);
    expect(await readYourModels(db, 'vision')).toEqual([kimi, grok]);

    await setChosenModel(db, 'vision', kimi);
    await addScore(db, 'vision', kimi.id, 1);
    await removeYourModel(db, 'vision', kimi.id);
    expect(await readYourModels(db, 'vision')).toEqual([grok]);
    expect(await readChosenModel(db, 'vision')).toBeNull();
    expect(await readScores(db, 'vision')).toEqual({ [kimi.id]: 1 });

    await addYourModel(db, 'vision', kimi);
    expect(await readYourModels(db, 'vision')).toEqual([grok, kimi]);
  });

  it('adds scores up across rounds, per kind, never below 0', async () => {
    const db = makeTestDb();
    // Round one: two thumbs up for Kimi, one taken back.
    await addScore(db, 'writing', kimi.id, 1);
    await addScore(db, 'writing', kimi.id, 1);
    await addScore(db, 'writing', kimi.id, -1);
    // Round two: one more for Kimi, one for Grok.
    await addScore(db, 'writing', kimi.id, 1);
    await addScore(db, 'writing', grok.id, 1);
    await addScore(db, 'vision', kimi.id, 1);
    await addScore(db, 'vision', grok.id, -1);
    expect(await readScores(db, 'writing')).toEqual({ [kimi.id]: 2, [grok.id]: 1 });
    expect(await readScores(db, 'vision')).toEqual({ [kimi.id]: 1, [grok.id]: 0 });
  });

  it('throws on a row of the wrong shape instead of reading a default', async () => {
    const db = makeTestDb();
    await db.insert(schema.aiState).values({ key: 'yourModels:writing', value: [{ id: 1 }] });
    await db.insert(schema.aiState).values({ key: 'score:writing:kimi-k3', value: 'many' });
    await expect(readYourModels(db, 'writing')).rejects.toThrow(
      'ai_state "yourModels:writing" holds an unexpected value',
    );
    await expect(readScores(db, 'writing')).rejects.toThrow('unexpected value');
  });
});
