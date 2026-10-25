import { describe, expect, it } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import {
  addScore,
  addYourModel,
  markTried,
  readChosenModelId,
  readChosenModels,
  readModelList,
  readVisionPhotos,
  readWritingPrompt,
  removeYourModel,
  resetScores,
  seedYourModels,
  setChosenModel,
  setVisionPhotos,
  setWritingPrompt,
} from '../src/sync/aiStateRepository';
import * as assetsRepository from '../src/sync/assetsRepository';

const kimi = { id: 'kimi-k3', name: 'Kimi K3' };
const grok = { id: 'grok-4-7', name: 'Grok 4.7' };
const scored = (model: typeof kimi, score: number | null = null) => ({ ...model, score });

describe('aiStateRepository', () => {
  it('reads nothing before the first write', async () => {
    const db = makeTestDb();
    expect(await readModelList(db, 'writing')).toBeNull();
    expect(await readChosenModelId(db, 'writing')).toBeNull();
    expect(await readChosenModels(db)).toEqual({ writing: null, vision: null });
    expect(await readWritingPrompt(db)).toBeNull();
    expect(await readVisionPhotos(db)).toEqual([]);
  });

  it('seeds your models once, even when they were all removed since', async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    expect(await readModelList(db, 'writing')).toEqual({ chosenId: null, models: [scored(kimi), scored(grok)] });
    await removeYourModel(db, 'writing', kimi.id);
    await removeYourModel(db, 'writing', grok.id);
    await seedYourModels(db, 'writing', [kimi, grok]);
    expect(await readModelList(db, 'writing')).toEqual({ chosenId: null, models: [] });
    expect(await readModelList(db, 'vision')).toBeNull();
  });

  it('chooses per kind and reads the chosen names', async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    await seedYourModels(db, 'vision', [grok]);
    await setChosenModel(db, 'writing', kimi.id);
    expect(await readChosenModelId(db, 'writing')).toBe(kimi.id);
    expect(await readChosenModelId(db, 'vision')).toBeNull();
    expect(await readChosenModels(db)).toEqual({ writing: kimi, vision: null });
  });

  it('adds a model at the end once, and removing it keeps its score and clears the choice', async () => {
    const db = makeTestDb();
    await addYourModel(db, 'vision', kimi);
    await addYourModel(db, 'vision', grok);
    await addYourModel(db, 'vision', kimi);
    expect((await readModelList(db, 'vision'))?.models).toEqual([scored(kimi), scored(grok)]);

    await setChosenModel(db, 'vision', kimi.id);
    await addScore(db, 'vision', kimi.id, 1);
    await removeYourModel(db, 'vision', kimi.id);
    expect(await readModelList(db, 'vision')).toEqual({ chosenId: null, models: [scored(grok)] });

    await addYourModel(db, 'vision', kimi);
    expect((await readModelList(db, 'vision'))?.models).toEqual([scored(grok), scored(kimi, 1)]);

    // An add counts as the list's start: the seed no longer applies.
    await seedYourModels(db, 'vision', [{ id: 'gemma', name: 'Gemma' }]);
    expect((await readModelList(db, 'vision'))?.models.map(({ id }) => id)).toEqual([grok.id, kimi.id]);
  });

  it('adds scores up across rounds, per kind, never below 0', async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    await seedYourModels(db, 'vision', [kimi, grok]);
    // Round one: two thumbs up for Kimi, one taken back.
    await addScore(db, 'writing', kimi.id, 1);
    await addScore(db, 'writing', kimi.id, 1);
    await addScore(db, 'writing', kimi.id, -1);
    // Round two: one more for Kimi, one for Grok.
    await addScore(db, 'writing', kimi.id, 1);
    await addScore(db, 'writing', grok.id, 1);
    await addScore(db, 'vision', kimi.id, 1);
    await addScore(db, 'vision', grok.id, -1);
    expect((await readModelList(db, 'writing'))?.models).toEqual([scored(kimi, 2), scored(grok, 1)]);
    expect((await readModelList(db, 'vision'))?.models).toEqual([scored(kimi, 1), scored(grok, 0)]);
  });

  it('marks a compared model as tried with 0, keeping a score it already has', async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    await addScore(db, 'writing', kimi.id, 1);
    await markTried(db, 'writing', [kimi.id, grok.id]);
    expect((await readModelList(db, 'writing'))?.models).toEqual([scored(kimi, 1), scored(grok, 0)]);
  });

  it("resets one model's score or every score of a kind, and the other kind keeps its own", async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    await seedYourModels(db, 'vision', [kimi]);
    for (const model of [kimi, grok]) await addScore(db, 'writing', model.id, 1);
    await addScore(db, 'vision', kimi.id, 1);
    await resetScores(db, 'writing', kimi.id);
    expect((await readModelList(db, 'writing'))?.models).toEqual([scored(kimi), scored(grok, 1)]);
    await resetScores(db, 'writing');
    expect((await readModelList(db, 'writing'))?.models).toEqual([scored(kimi), scored(grok)]);
    expect((await readModelList(db, 'vision'))?.models).toEqual([scored(kimi, 1)]);
  });

  it('remembers the writing prompt once the writing list exists', async () => {
    const db = makeTestDb();
    await expect(setWritingPrompt(db, 'Write')).rejects.toThrow('never set up');
    await seedYourModels(db, 'writing', [kimi]);
    await setWritingPrompt(db, 'Write');
    expect(await readWritingPrompt(db)).toBe('Write');
  });

  it('reads the photo set in order, without the photos deleted since', async () => {
    const db = makeTestDb();
    await assetsRepository.createMany(db, [
      makeAssetRecord({ id: 'a1' }),
      makeAssetRecord({ id: 'a2' }),
      makeAssetRecord({ id: 'a3' }),
    ]);
    await setVisionPhotos(db, ['a3', 'a1', 'a2']);
    await assetsRepository.update(db, 'a1', { deletedAt: 5 });
    expect((await readVisionPhotos(db)).map(({ id }) => id)).toEqual(['a3', 'a2']);
    await setVisionPhotos(db, ['a2']);
    expect((await readVisionPhotos(db)).map(({ id }) => id)).toEqual(['a2']);
  });
});
