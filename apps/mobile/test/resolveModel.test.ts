import { describe, it, expect, vi, beforeEach } from 'vitest';

const storage = new Map<string, string>();
const removeItem = vi.fn(async (key: string) => {
  storage.delete(key);
});
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async (key: string) => storage.get(key) ?? null, removeItem },
}));

const { DEFAULT_MODEL, MODEL_STORAGE_KEY } = await import('../src/features/ai-suggestions/aiSuggestionsStorage');
const { default: isSupportedModel } = await import('../src/features/ai-suggestions/isSupportedModel');
const { default: resolveModel } = await import('../src/features/ai-suggestions/resolveModel');

describe('isSupportedModel', () => {
  it('allows chat models with strict structured outputs, also fine-tuned ones', () => {
    for (const id of [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4o-2024-08-06',
      'gpt-4.1',
      'gpt-4.1-nano',
      'gpt-5',
      'gpt-5-mini',
      'gpt-5.1',
      'o1',
      'o3-mini',
      'o4-mini',
      'ft:gpt-4o-mini-2024-07-18:my-org:captions:9abcDEF1',
      'ft:gpt-4o-2024-08-06:my-org::9abcDEF1',
      'ft:gpt-4.1-2025-04-14:my-org:search-tone:9abcDEF1',
    ]) {
      expect(isSupportedModel(id), id).toBe(true);
    }
  });

  it('rejects older, non-chat and Responses-only models', () => {
    for (const id of [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'gpt-4o-2024-05-13',
      'chatgpt-4o-latest',
      'gpt-4o-audio-preview',
      'gpt-4o-realtime-preview',
      'gpt-4o-mini-search-preview',
      'gpt-4o-transcribe',
      'gpt-4o-mini-tts',
      'gpt-image-1',
      'gpt-5-codex',
      'gpt-5-pro',
      'o1-mini',
      'o1-preview',
      'o3-pro',
      'o3-deep-research',
      'omni-moderation-latest',
      'text-embedding-3-small',
      'whisper-1',
      'dall-e-3',
      'ft:gpt-3.5-turbo-0125:my-org::9abcDEF1',
      'ft:davinci-002:my-org::9abcDEF1',
    ]) {
      expect(isSupportedModel(id), id).toBe(false);
    }
  });
});

describe('resolveModel', () => {
  beforeEach(() => {
    storage.clear();
    removeItem.mockClear();
  });

  it('uses the default when no model is stored', async () => {
    expect(await resolveModel()).toBe(DEFAULT_MODEL);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('uses a stored supported model', async () => {
    storage.set(MODEL_STORAGE_KEY, 'gpt-4.1-mini');
    expect(await resolveModel()).toBe('gpt-4.1-mini');
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('forgets a stored unsupported model once, so every screen falls back to the default', async () => {
    storage.set(MODEL_STORAGE_KEY, 'gpt-3.5-turbo');
    expect(await resolveModel()).toBe(DEFAULT_MODEL);
    expect(await resolveModel()).toBe(DEFAULT_MODEL);
    expect(storage.has(MODEL_STORAGE_KEY)).toBe(false);
    expect(removeItem).toHaveBeenCalledTimes(1);
  });
});
