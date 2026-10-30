import { modelPickIds, resolveModelDefaults, resolveModelId, type ModelDefaults } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

// The server's model_defaults, as the catalog brings them.
const defaults: ModelDefaults = {
  writing: { regular: 'claude-sonnet-5-5', unrestricted: 'deepseek-v4-1-flash-uncensored' },
  vision: { regular: 'gemma-4-uncensored', unrestricted: 'qwen-3-6-plus' },
};
const kimi = { id: 'kimi-k3', name: 'Kimi K3' };
const venice = { id: 'venice-uncensored-1-2', name: 'Venice Uncensored' };

// What Apply changes for everyone sends: the picks' ids, null for none.
describe('modelPickIds', () => {
  it("is each variant's pick of the kind, null without one", () => {
    expect(modelPickIds('writing', null)).toEqual({ regular: null, unrestricted: null });
    expect(modelPickIds('writing', { writingUncensoredModel: venice, visionModel: kimi })).toEqual({
      regular: null,
      unrestricted: 'venice-uncensored-1-2',
    });
  });
});

// The defaults an ai_admin's account uses: their picks over the published ones.
describe('resolveModelDefaults', () => {
  it('is the published defaults without picks', () => {
    expect(resolveModelDefaults('writing', null, defaults)).toEqual(defaults.writing);
    expect(resolveModelDefaults('vision', undefined, defaults)).toEqual(defaults.vision);
  });

  it('takes each variant from its pick, else the published default', () => {
    expect(resolveModelDefaults('writing', { writingModel: kimi }, defaults)).toEqual({
      regular: 'kimi-k3',
      unrestricted: 'deepseek-v4-1-flash-uncensored',
    });
    expect(resolveModelDefaults('writing', { writingModel: kimi, writingUncensoredModel: venice }, defaults)).toEqual({
      regular: 'kimi-k3',
      unrestricted: 'venice-uncensored-1-2',
    });
    // another kind's picks don't count
    expect(resolveModelDefaults('vision', { writingModel: kimi }, defaults)).toEqual(defaults.vision);
  });
});

// The model useYourModels shows as used (and the server's readChosenModelId uses).
describe('resolveModelId', () => {
  it('defaults to the regular model, and to the Uncensored default with Adult content on', () => {
    expect(resolveModelId('writing', null, false, defaults)).toBe('claude-sonnet-5-5');
    expect(resolveModelId('writing', null, undefined, defaults)).toBe('claude-sonnet-5-5');
    expect(resolveModelId('writing', null, true, defaults)).toBe('deepseek-v4-1-flash-uncensored');
    expect(resolveModelId('vision', null, false, defaults)).toBe('gemma-4-uncensored');
    expect(resolveModelId('vision', null, true, defaults)).toBe('qwen-3-6-plus');
  });

  it("uses the pick of the switch's variant, and falls back per variant", () => {
    const picks = { writingModel: kimi, writingUncensoredModel: null, visionModel: null };
    expect(resolveModelId('writing', picks, false, defaults)).toBe('kimi-k3');
    expect(resolveModelId('writing', picks, true, defaults)).toBe('deepseek-v4-1-flash-uncensored');
    expect(resolveModelId('writing', { writingUncensoredModel: venice }, true, defaults)).toBe('venice-uncensored-1-2');
    expect(resolveModelId('writing', { writingUncensoredModel: venice }, false, defaults)).toBe('claude-sonnet-5-5');
  });

  it('ignores undefined fields (a record from a build without the Uncensored picks)', () => {
    const picks = { writingModel: kimi, visionModel: null, writingUncensoredModel: undefined };
    expect(resolveModelId('writing', picks, true, defaults)).toBe('deepseek-v4-1-flash-uncensored');
  });
});
