import { type AiModelsResponse, type ApiAiModel, DEFAULT_INSTRUCTIONS } from '@squidbox/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeApiModel } from './helpers/makeApiModel';

const setUncensored = vi.fn<(modelId: string, uncensored: boolean | null) => Promise<AiModelsResponse>>();
vi.mock('@/utils/cloud-api/ai/setUncensoredAsync', () => ({ default: setUncensored }));
vi.mock('react-native', () => ({ Alert: { alert: () => {} } }));

const { default: uncensoredMarks } = await import('../src/features/model-compare/uncensoredMarks');
const { default: aiCatalogStore } = await import('../src/lib/aiCatalogStore');

const model = (id: string, isVeniceUncensored = false) =>
  makeApiModel({ id, name: id, isUncensored: isVeniceUncensored, isVeniceUncensored });

const answer = (models: ApiAiModel[]): AiModelsResponse => ({
  models,
  defaults: {
    writing: { regular: 'a', unrestricted: 'a' },
    vision: { regular: 'a', unrestricted: 'a' },
  },
  instructions: DEFAULT_INSTRUCTIONS,
});

// A write the test answers when it wants.
function deferred() {
  let resolve!: (value: AiModelsResponse) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<AiModelsResponse>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

// Every write waits for the one before it: lets the queue reach the next write or settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('uncensoredMarks', () => {
  beforeEach(() => setUncensored.mockReset());

  it('shows a tap at once and forgets it once the server has it', async () => {
    const write = deferred();
    setUncensored.mockReturnValueOnce(write.promise);
    const tapped = model('shows-at-once');

    uncensoredMarks.set(tapped, true, () => {});
    expect(uncensoredMarks.wanted.get()['shows-at-once']).toBe(true);

    const marked = answer([{ ...tapped, isUncensored: true, uncensoredOverride: true }]);
    write.resolve(marked);
    await settle();
    expect(uncensoredMarks.wanted.get()).not.toHaveProperty('shows-at-once');
    expect(aiCatalogStore.get().models).toBe(marked.models);
  });

  it("sends null when the mark equals Venice's own rating, else the mark", async () => {
    setUncensored.mockResolvedValue(answer([]));
    const rated = model('rated', true);

    uncensoredMarks.set(rated, true, () => {});
    await settle();
    uncensoredMarks.set(rated, false, () => {});
    await settle();
    expect(setUncensored.mock.calls).toEqual([
      ['rated', null],
      ['rated', false],
    ]);
  });

  it('a tap made during a write that lands has its own write after it', async () => {
    const first = deferred();
    const second = deferred();
    setUncensored.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const tapped = model('tapped-twice');

    uncensoredMarks.set(tapped, true, () => {});
    await settle();
    uncensoredMarks.set(tapped, false, () => {});
    await settle();
    expect(setUncensored).toHaveBeenCalledTimes(1);

    first.resolve(answer([]));
    await settle();
    expect(uncensoredMarks.wanted.get()['tapped-twice']).toBe(false);
    expect(setUncensored.mock.calls).toEqual([
      ['tapped-twice', true],
      ['tapped-twice', null],
    ]);

    second.resolve(answer([]));
    await settle();
    expect(uncensoredMarks.wanted.get()).not.toHaveProperty('tapped-twice');
  });

  it("a tap made during a write that fails has its own write after it, and the failed write doesn't alert", async () => {
    const first = deferred();
    const second = deferred();
    setUncensored.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const tapped = model('fails-then-tapped');
    const failure = new Error('offline');
    const onFirstError = vi.fn();

    uncensoredMarks.set(tapped, true, onFirstError);
    await settle();
    uncensoredMarks.set(tapped, false, () => {});
    await settle();

    first.reject(failure);
    await settle();
    expect(onFirstError).not.toHaveBeenCalled();
    expect(uncensoredMarks.wanted.get()['fails-then-tapped']).toBe(false);
    expect(setUncensored.mock.calls).toEqual([
      ['fails-then-tapped', true],
      ['fails-then-tapped', null],
    ]);

    second.resolve(answer([]));
    await settle();
    expect(uncensoredMarks.wanted.get()).not.toHaveProperty('fails-then-tapped');
  });

  it('a tap back to the failed mark during the write still has its write sent', async () => {
    const first = deferred();
    setUncensored.mockReturnValueOnce(first.promise).mockResolvedValueOnce(answer([]));
    const tapped = model('on-off-on');

    uncensoredMarks.set(tapped, true, () => {});
    await settle();
    uncensoredMarks.set(tapped, false, () => {});
    uncensoredMarks.set(tapped, true, () => {});
    first.reject(new Error('offline'));
    await settle();
    expect(setUncensored.mock.calls).toEqual([
      ['on-off-on', true],
      ['on-off-on', true],
    ]);
    expect(uncensoredMarks.wanted.get()).not.toHaveProperty('on-off-on');
  });

  it('keeps writing after a report of a failed write throws', async () => {
    setUncensored.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(answer([]));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    uncensoredMarks.set(model('report-throws'), true, () => {
      throw new Error('alert failed');
    });
    await settle();
    uncensoredMarks.set(model('after-throw'), true, () => {});
    await settle();
    expect(setUncensored.mock.calls).toEqual([
      ['report-throws', true],
      ['after-throw', true],
    ]);
    logged.mockRestore();
  });

  it('puts the mark back and reports a failed write', async () => {
    const failure = new Error('offline');
    setUncensored.mockRejectedValueOnce(failure);
    const onError = vi.fn();

    uncensoredMarks.set(model('fails'), true, onError);
    await settle();
    expect(uncensoredMarks.wanted.get()).not.toHaveProperty('fails');
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
