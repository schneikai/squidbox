import { describe, expect, it } from 'vitest';

import modelDetailText from '../src/utils/ai/modelDetailText';

const model = {
  costPerReplyUsd: 0.0004,
  costPer100PhotosUsd: 0.02,
  reasoning: { supported: false, defaultEffort: null },
};

describe('modelDetailText', () => {
  it('joins the score, the reasoning and the cost', () => {
    expect(modelDetailText(model, 'writing', 9)).toBe('9 thumbs up · no reasoning · 0.04¢ a reply');
    expect(modelDetailText(model, 'writing', null)).toBe('Not tried yet · no reasoning · 0.04¢ a reply');
    expect(modelDetailText({ ...model, reasoning: { supported: true, defaultEffort: 'max' } }, 'vision', 34)).toBe(
      '34 tags fit · reasons · effort max · 0.02¢ a photo',
    );
  });

  it('puts Unrestricted after the score for a model that counts as unrestricted', () => {
    expect(modelDetailText({ ...model, isUncensored: true }, 'writing', 9)).toBe(
      '9 thumbs up · Unrestricted · no reasoning · 0.04¢ a reply',
    );
  });

  it('leaves the score out when there is none to show', () => {
    expect(modelDetailText(model, 'writing')).toBe('no reasoning · 0.04¢ a reply');
  });
});
