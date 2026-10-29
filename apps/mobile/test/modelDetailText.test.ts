import { describe, expect, it } from 'vitest';

import modelDetailText from '../src/utils/ai/modelDetailText';

const model = {
  costPerReplyUsd: 0.0004,
  costPer100PhotosUsd: 0.02,
  reasoning: { supported: false, defaultEffort: null },
};

describe('modelDetailText', () => {
  it('joins the score, the cost and the thinking', () => {
    expect(modelDetailText(model, 'writing', 9)).toBe('9 thumbs up · 0.04¢ a reply · no thinking');
    expect(modelDetailText(model, 'writing', null)).toBe('Not tried yet · 0.04¢ a reply · no thinking');
    expect(modelDetailText({ ...model, reasoning: { supported: true, defaultEffort: 'max' } }, 'vision', 34)).toBe(
      '34 tags fit · 0.02¢ a photo · effort max',
    );
  });

  it('ends with Unrestricted for a model that counts as unrestricted', () => {
    expect(modelDetailText({ ...model, isUncensored: true }, 'writing', 9)).toBe(
      '9 thumbs up · 0.04¢ a reply · no thinking · Unrestricted',
    );
  });

  it('leaves the score out when there is none to show', () => {
    expect(modelDetailText(model, 'writing')).toBe('0.04¢ a reply · no thinking');
  });
});
