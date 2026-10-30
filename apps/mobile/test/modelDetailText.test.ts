import { describe, expect, it } from 'vitest';

import modelDetailText from '../src/utils/ai/modelDetailText';

const model = {
  costPerReplyUsd: 0.0004,
  costPer100PhotosUsd: 0.02,
  reasoning: { supported: false, defaultEffort: null },
};

describe('modelDetailText', () => {
  it('joins the reasoning and the cost, leaving out a reasoning the model lacks', () => {
    expect(modelDetailText(model, 'writing')).toBe('0.04¢ a reply');
    expect(modelDetailText({ ...model, reasoning: { supported: true, defaultEffort: 'max' } }, 'vision')).toBe(
      'reasons · effort max · 0.02¢ a photo',
    );
  });

  it('puts uncensored first for a model that counts as uncensored', () => {
    expect(modelDetailText({ ...model, isUncensored: true }, 'writing')).toBe('uncensored · 0.04¢ a reply');
  });

  it('names vision after uncensored for a writing model that sees photos, not for a vision model', () => {
    const seeing = {
      ...model,
      isUncensored: true,
      supportsVision: true,
      reasoning: { supported: true, defaultEffort: null },
    };
    expect(modelDetailText(seeing, 'writing')).toBe('uncensored · vision · reasons · 0.04¢ a reply');
    expect(modelDetailText(seeing, 'vision')).toBe('uncensored · reasons · 0.02¢ a photo');
  });
});
