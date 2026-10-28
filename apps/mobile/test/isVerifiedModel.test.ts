import { DEFAULT_MODEL_IDS, VERIFIED_MODELS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import isVerifiedModel from '../src/features/model-compare/isVerifiedModel';

describe('isVerifiedModel', () => {
  it('marks the models Squidbox checked, per kind', () => {
    expect(isVerifiedModel('writing', 'deepseek-v4-1-flash-uncensored')).toBe(true);
    expect(isVerifiedModel('vision', 'gemma-4-uncensored')).toBe(true);
    expect(isVerifiedModel('vision', 'deepseek-v4-1-flash-uncensored')).toBe(false);
    expect(isVerifiedModel('writing', 'claude-sonnet-5-5')).toBe(true);
    expect(isVerifiedModel('writing', 'venice-uncensored-1-2')).toBe(false);
  });

  it('has each writing default verified, and unrestricted only for Adult content', () => {
    const verified = (id: string) => VERIFIED_MODELS.writing.find((model) => model.id === id);
    expect(verified(DEFAULT_MODEL_IDS.writing.regular)?.unrestricted).toBe(false);
    expect(verified(DEFAULT_MODEL_IDS.writing.unrestricted)?.unrestricted).toBe(true);
    expect(isVerifiedModel('vision', DEFAULT_MODEL_IDS.vision.regular)).toBe(true);
    expect(isVerifiedModel('vision', DEFAULT_MODEL_IDS.vision.unrestricted)).toBe(true);
  });
});
