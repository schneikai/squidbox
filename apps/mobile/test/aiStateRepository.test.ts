import { describe, expect, it } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import {
  addScore,
  addYourModel,
  markTried,
  readLiveAssets,
  readModelList,
  readVisionPhotos,
  readPrompt,
  readRemovedModels,
  removeYourModel,
  resetScores,
  seedYourModels,
  setModelNote,
  setVisionPhotos,
  setPrompt,
} from '../src/sync/aiStateRepository';
import * as assetsRepository from '../src/sync/assetsRepository';

const kimi = { id: 'kimi-k3', name: 'Kimi K3' };
const grok = { id: 'grok-4-7', name: 'Grok 4.7' };
const scored = (model: typeof kimi, score: number | null = null, note: string | null = null) => ({
  ...model,
  score,
  note,
});

describe('aiStateRepository', () => {
  it('reads nothing before the first write', async () => {
    const db = makeTestDb();
    expect(await readModelList(db, 'writing')).toBeNull();
    expect(await readPrompt(db, 'writing')).toBeNull();
    expect(await readVisionPhotos(db)).toEqual([]);
  });

  it('seeds your models once, even when they were all removed since', async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    expect(await readModelList(db, 'writing')).toEqual([scored(kimi), scored(grok)]);
    await removeYourModel(db, 'writing', kimi.id);
    await removeYourModel(db, 'writing', grok.id);
    await seedYourModels(db, 'writing', [kimi, grok]);
    expect(await readModelList(db, 'writing')).toEqual([]);
    expect(await readModelList(db, 'vision')).toBeNull();
  });

  it('adds a model at the end once, and removing it keeps its score', async () => {
    const db = makeTestDb();
    await addYourModel(db, 'vision', kimi);
    await addYourModel(db, 'vision', grok);
    await addYourModel(db, 'vision', kimi);
    expect(await readModelList(db, 'vision')).toEqual([scored(kimi), scored(grok)]);

    await addScore(db, 'vision', kimi.id, 1);
    await removeYourModel(db, 'vision', kimi.id);
    expect(await readModelList(db, 'vision')).toEqual([scored(grok)]);

    await addYourModel(db, 'vision', kimi);
    expect(await readModelList(db, 'vision')).toEqual([scored(grok), scored(kimi, 1)]);

    // An add counts as the list's start: the seed no longer applies.
    await seedYourModels(db, 'vision', [{ id: 'gemma', name: 'Gemma' }]);
    expect((await readModelList(db, 'vision')).map(({ id }) => id)).toEqual([grok.id, kimi.id]);
  });

  it('keeps a removed model with its note, shows it as removed, and brings it back as it was', async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    await setModelNote(db, 'writing', kimi.id, 'Too wordy');
    await addScore(db, 'writing', kimi.id, 1);
    expect(await readModelList(db, 'writing')).toEqual([scored(kimi, 1, 'Too wordy'), scored(grok)]);

    await removeYourModel(db, 'writing', kimi.id);
    expect(await readModelList(db, 'writing')).toEqual([scored(grok)]);
    expect(await readRemovedModels(db, 'writing')).toEqual(new Map([[kimi.id, { note: 'Too wordy', score: 1 }]]));

    await addYourModel(db, 'writing', kimi);
    expect(await readModelList(db, 'writing')).toEqual([scored(grok), scored(kimi, 1, 'Too wordy')]);
    expect(await readRemovedModels(db, 'writing')).toEqual(new Map());

    await setModelNote(db, 'writing', kimi.id, '');
    expect((await readModelList(db, 'writing'))[1].note).toBeNull();
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
    expect(await readModelList(db, 'writing')).toEqual([scored(kimi, 2), scored(grok, 1)]);
    expect(await readModelList(db, 'vision')).toEqual([scored(kimi, 1), scored(grok, 0)]);
  });

  it('marks a compared model as tried with 0, keeping a score it already has', async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    await addScore(db, 'writing', kimi.id, 1);
    await markTried(db, 'writing', [kimi.id, grok.id]);
    expect(await readModelList(db, 'writing')).toEqual([scored(kimi, 1), scored(grok, 0)]);
  });

  it("resets one model's score or every score of a kind, and the other kind keeps its own", async () => {
    const db = makeTestDb();
    await seedYourModels(db, 'writing', [kimi, grok]);
    await seedYourModels(db, 'vision', [kimi]);
    for (const model of [kimi, grok]) await addScore(db, 'writing', model.id, 1);
    await addScore(db, 'vision', kimi.id, 1);
    await resetScores(db, 'writing', kimi.id);
    expect(await readModelList(db, 'writing')).toEqual([scored(kimi), scored(grok, 1)]);
    await resetScores(db, 'writing');
    expect(await readModelList(db, 'writing')).toEqual([scored(kimi), scored(grok)]);
    expect(await readModelList(db, 'vision')).toEqual([scored(kimi, 1)]);
  });

  it("remembers each kind's prompt once its list exists", async () => {
    const db = makeTestDb();
    await expect(setPrompt(db, 'writing', 'Write')).rejects.toThrow('never set up');
    await seedYourModels(db, 'writing', [kimi]);
    await setPrompt(db, 'writing', 'Write');
    await seedYourModels(db, 'vision', [kimi]);
    await setPrompt(db, 'vision', 'Tag');
    expect(await readPrompt(db, 'writing')).toBe('Write');
    expect(await readPrompt(db, 'vision')).toBe('Tag');
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

  it('reads the live assets of a pick, once each, in its order', async () => {
    const db = makeTestDb();
    await assetsRepository.createMany(db, [makeAssetRecord({ id: 'a1' }), makeAssetRecord({ id: 'a2' })]);
    await assetsRepository.update(db, 'a1', { deletedAt: 5 });
    expect((await readLiveAssets(db, ['a2', 'gone', 'a1', 'a2'])).map(({ id }) => id)).toEqual(['a2']);
    expect(await readLiveAssets(db, [])).toEqual([]);
  });
});
