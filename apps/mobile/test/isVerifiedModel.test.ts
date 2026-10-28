import { DEFAULT_MODEL_IDS } from '@squidbox/shared';
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

  it('has the vision default verified', () => {
    expect(isVerifiedModel('vision', DEFAULT_MODEL_IDS.vision)).toBe(true);
  });
});
