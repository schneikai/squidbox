import { DEFAULT_MODEL_IDS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import isVerifiedModel from '../src/features/model-compare/isVerifiedModel';

describe('isVerifiedModel', () => {
  it('marks the models Squidbox checked, per kind', () => {
    expect(isVerifiedModel('writing', 'deepseek-v4-1-flash-uncensored')).toBe(true);
    expect(isVerifiedModel('vision', 'gemma-4-uncensored')).toBe(true);
    expect(isVerifiedModel('vision', 'deepseek-v4-1-flash-uncensored')).toBe(false);
    expect(isVerifiedModel('writing', 'kimi-k3')).toBe(false);
  });

  it('has each default model verified', () => {
    expect(isVerifiedModel('writing', DEFAULT_MODEL_IDS.writing)).toBe(true);
    expect(isVerifiedModel('vision', DEFAULT_MODEL_IDS.vision)).toBe(true);
  });
});
