import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Venice's key and address as the client reads them from the config.
vi.mock('../src/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/config.js')>();
  return {
    ...original,
    loadConfig: () => ({
      ...original.loadConfig(),
      VENICE_API_KEY: 'test-key',
      VENICE_BASE_URL: 'https://venice.test/api/v1',
    }),
  };
});

import fixture from './fixtures/venice-models.json';
import {
  clearCatalogCache,
  fetchCatalogAsync,
  findModel,
  getCatalogAsync,
  isUncensored,
  isVeniceUncensored,
  toApiModel,
  type CatalogEntry,
} from '../src/ai/catalog.js';

const fetchMock = vi.fn();

function answer(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function catalog(): Promise<CatalogEntry[]> {
  fetchMock.mockResolvedValueOnce(answer(fixture));
  return fetchCatalogAsync();
}

const byId = (entries: CatalogEntry[], id: string) => entries.find((entry) => entry.id === id)!;

// No overrides: the label is Venice's.
const NOTHING_VERIFIED = { verified: { writing: new Set<string>(), vision: new Set<string>() }, overrides: new Map() };

beforeEach(() => {
  clearCatalogCache();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchCatalogAsync', () => {
  it('reads every entry of the model list with the key', async () => {
    const entries = await catalog();
    expect(entries.map((entry) => entry.id)).toEqual(fixture.data.map((entry) => entry.id));
    expect(fetchMock).toHaveBeenCalledWith('https://venice.test/api/v1/models', expect.anything());
    expect(fetchMock.mock.calls[0]![1].headers).toEqual({ authorization: 'Bearer test-key' });
  });

  it('leaves out an entry without the fields it needs', async () => {
    fetchMock.mockResolvedValueOnce(answer({ data: [...fixture.data, { id: 'broken', model_spec: {} }] }));
    const entries = await fetchCatalogAsync();
    expect(entries).toHaveLength(fixture.data.length);
  });

  it('throws when Venice answers an error', async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: 'nope' }, 500));
    await expect(fetchCatalogAsync()).rejects.toThrow('Venice /models failed (500)');
  });
});

describe('getCatalogAsync', () => {
  it('serves one fetch for five minutes and refetches after', async () => {
    fetchMock.mockImplementation(async () => answer(fixture));
    await getCatalogAsync(0);
    await getCatalogAsync(4 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getCatalogAsync(5 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares a fetch in flight', async () => {
    fetchMock.mockImplementation(async () => answer(fixture));
    const [first, second] = await Promise.all([getCatalogAsync(0), getCatalogAsync(1)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('tries again on the next call after a failed fetch', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(getCatalogAsync(0)).rejects.toThrow('offline');
    fetchMock.mockResolvedValueOnce(answer(fixture));
    await expect(getCatalogAsync(1)).resolves.toHaveProperty('entries');
  });

  it('throws when a refresh fails instead of serving the old list', async () => {
    fetchMock.mockResolvedValueOnce(answer(fixture));
    await getCatalogAsync(0);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(getCatalogAsync(6 * 60 * 1000)).rejects.toThrow('offline');
  });
});

describe('isUncensored', () => {
  it('follows Venice without an override: the "Uncensored" names and the most_uncensored trait', async () => {
    const entries = await catalog();
    for (const id of [
      'venice-uncensored-1-2',
      'qwen-3-6-plus',
      'gemma-4-uncensored',
      'deepseek-v4-1-flash-uncensored',
    ]) {
      expect(isVeniceUncensored(byId(entries, id))).toBe(true);
      expect(isUncensored(byId(entries, id), null)).toBe(true);
    }
    const traitOnly = byId(entries, 'z-ai-glm-5-3');
    const traited = { ...traitOnly, model_spec: { ...traitOnly.model_spec, traits: ['most_uncensored'] } };
    expect(isUncensored(traited, null)).toBe(true);
    for (const id of ['z-ai-glm-5-3', 'grok-4-7', 'kimi-k3']) {
      expect(isUncensored(byId(entries, id), null)).toBe(false);
    }
  });

  it('takes an override over Venice either way', async () => {
    const entries = await catalog();
    expect(isUncensored(byId(entries, 'kimi-k3'), true)).toBe(true);
    expect(isUncensored(byId(entries, 'qwen-3-6-plus'), false)).toBe(false);
  });
});

describe('toApiModel', () => {
  it('estimates the costs from the per-1M-token prices', async () => {
    const entries = await catalog();
    // Gemma 4 Uncensored: $0.1625 in, $0.5 out per 1M tokens.
    const gemma = toApiModel(byId(entries, 'gemma-4-uncensored'), NOTHING_VERIFIED);
    expect(gemma).toEqual({
      id: 'gemma-4-uncensored',
      name: 'Gemma 4 Uncensored',
      supportsVision: true,
      isUncensored: true,
      isVeniceUncensored: true,
      verifiedKinds: [],
      uncensoredOverride: null,
      reasoning: { supported: false, defaultEffort: null },
      costPerReplyUsd: expect.closeTo((1000 * 0.1625 + 200 * 0.5) / 1e6, 12),
      costPer100PhotosUsd: expect.closeTo((100 * (1500 * 0.1625 + 100 * 0.5)) / 1e6, 12),
    });
  });

  it("carries Venice's reasoning: none, reasoning without a default effort, and a default effort", async () => {
    const entries = await catalog();
    const reasoning = (id: string) => toApiModel(byId(entries, id), NOTHING_VERIFIED).reasoning;
    expect(reasoning('gemma-4-uncensored')).toEqual({ supported: false, defaultEffort: null });
    expect(reasoning('kimi-k3')).toEqual({ supported: true, defaultEffort: null });
    expect(reasoning('claude-sonnet-5-5')).toEqual({ supported: true, defaultEffort: 'high' });
  });

  it('keeps a model whose reasoning fields are null or odd: they are display only', async () => {
    const odd = structuredClone(fixture) as { data: { id: string; model_spec: { capabilities: object } }[] };
    const kimi = odd.data.find((entry) => entry.id === 'kimi-k3')!;
    kimi.model_spec.capabilities = {
      ...kimi.model_spec.capabilities,
      supportsReasoning: null,
      defaultReasoningEffort: 3,
    };
    fetchMock.mockResolvedValueOnce(answer(odd));
    const entries = await fetchCatalogAsync();
    expect(toApiModel(byId(entries, 'kimi-k3'), NOTHING_VERIFIED).reasoning).toEqual({
      supported: false,
      defaultEffort: null,
    });
  });

  it('has no photo cost for a model without vision', async () => {
    const glm = toApiModel(byId(await catalog(), 'z-ai-glm-5-3'), NOTHING_VERIFIED);
    expect(glm.costPerReplyUsd).toBeGreaterThan(0);
    expect(glm.supportsVision).toBe(false);
    expect(glm.costPer100PhotosUsd).toBeNull();
  });

  it('carries the kinds it is verified for and its override', async () => {
    const plain = byId(await catalog(), 'kimi-k3');
    const abliterated = {
      ...plain,
      id: 'abliteration-abliterated-model-large-flash',
      model_spec: { ...plain.model_spec, name: 'Abliterated Large Flash', traits: [] },
    };
    const verified = { writing: new Set([abliterated.id]), vision: new Set([abliterated.id]) };
    const overrides = new Map([[abliterated.id, true]]);
    expect(toApiModel(abliterated, { verified, overrides })).toMatchObject({
      isUncensored: true,
      isVeniceUncensored: false,
      verifiedKinds: ['writing', 'vision'],
      uncensoredOverride: true,
    });
  });
});

describe('findModel', () => {
  it('finds a model, and says why it is not usable', async () => {
    const entries = await catalog();
    expect(findModel(entries, 'kimi-k3', 'writing')).toEqual({ entry: byId(entries, 'kimi-k3') });
    expect(findModel(entries, 'gone', 'writing')).toEqual({ error: 'Venice no longer offers this model' });
    expect(findModel(entries, 'z-ai-glm-5-3', 'vision')).toEqual({ error: "This model can't see photos" });
    expect(findModel(entries, 'gemma-4-uncensored', 'vision')).toHaveProperty('entry');
    expect(findModel(entries, 'z-ai-glm-5-3', null)).toHaveProperty('entry');
  });
});
