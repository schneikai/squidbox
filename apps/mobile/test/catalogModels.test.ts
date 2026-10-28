import { describe, expect, it } from 'vitest';

import searchModels from '../src/features/model-compare/searchModels';
import joinYourModels from '../src/utils/ai/joinYourModels';
import modelsOfKind from '../src/utils/ai/modelsOfKind';
import seedModels from '../src/utils/ai/seedModels';

const model = (id: string, name: string, supportsVision = true, verifiedKinds: string[] = []) => ({
  id,
  name,
  supportsVision,
  isUncensored: false,
  isVeniceUncensored: false,
  verifiedKinds,
  uncensoredOverride: null,
  costPerReplyUsd: 0.001,
  costPer100PhotosUsd: supportsVision ? 0.02 : null,
});

const catalog = [
  model('kimi-k3', 'Kimi K3', true, ['writing']),
  model('z-ai-glm-5-3', 'GLM 5.3', false),
  model('gemma-4-uncensored', 'Gemma 4 Uncensored'),
  model('venice-uncensored-1-2', 'Venice Uncensored 1.2'),
  model('claude-sonnet-5-5', 'Claude Sonnet 5.5', false, ['writing']),
];

const defaults = {
  writing: { regular: 'claude-sonnet-5-5', unrestricted: 'deepseek-v4-1-flash-uncensored' },
  vision: { regular: 'gemma-4-uncensored', unrestricted: 'gemma-4-uncensored' },
};

describe('modelsOfKind', () => {
  it('is every model for writing and those that see photos for vision', () => {
    expect(modelsOfKind(catalog, 'writing')).toHaveLength(5);
    expect(modelsOfKind(catalog, 'vision').map(({ id }) => id)).toEqual([
      'kimi-k3',
      'gemma-4-uncensored',
      'venice-uncensored-1-2',
    ]);
  });
});

describe('searchModels', () => {
  it('matches the name or id, ignoring case, and keeps all for blank text', () => {
    expect(searchModels(catalog, '  ')).toBe(catalog);
    expect(searchModels(catalog, 'UNCENSORED').map(({ id }) => id)).toEqual([
      'gemma-4-uncensored',
      'venice-uncensored-1-2',
    ]);
    expect(searchModels(catalog, 'glm-5').map(({ id }) => id)).toEqual(['z-ai-glm-5-3']);
    expect(searchModels(catalog, 'nothing')).toEqual([]);
  });
});

describe('joinYourModels', () => {
  it('keeps your order and marks the models Venice no longer offers for the kind', () => {
    const yours = [
      { id: 'venice-uncensored-1-2', name: 'Venice Uncensored 1.2' },
      { id: 'gone-1', name: 'Gone 1' },
      { id: 'z-ai-glm-5-3', name: 'GLM 5.3' },
    ];
    expect(joinYourModels(yours, catalog, 'writing')).toEqual([
      { ...yours[0], model: catalog[3] },
      { ...yours[1], model: null },
      { ...yours[2], model: catalog[1] },
    ]);
    expect(joinYourModels(yours, catalog, 'vision')[2]!.model).toBeNull();
  });
});

describe('seedModels', () => {
  it("is the starting list's models that the catalog still has, in the seed order", () => {
    // writing: the verified models (the catalog's marks), the regular default first
    expect(seedModels(modelsOfKind(catalog, 'writing'), 'writing', defaults).map(({ id }) => id)).toEqual([
      'claude-sonnet-5-5',
      'kimi-k3',
    ]);
    expect(seedModels(modelsOfKind(catalog, 'vision'), 'vision', defaults).map(({ id }) => id)).toEqual([
      'gemma-4-uncensored',
      'venice-uncensored-1-2',
    ]);
  });
});
