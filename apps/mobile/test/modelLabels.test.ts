import { describe, expect, it } from 'vitest';

import modelLabels from '../src/utils/ai/modelLabels';

const defaults = {
  writing: { regular: 'claude', unrestricted: 'venice' },
  vision: { regular: 'gemma', unrestricted: 'gemma' },
};
const model = (id: string, verifiedKinds: string[], isUncensored = false) => ({ id, verifiedKinds, isUncensored });
const NONE = { verified: false, unrestricted: false, default: false, adultDefault: false };

describe('modelLabels', () => {
  it('has the labels of the model for the kind', () => {
    expect(modelLabels('writing', 'claude', model('claude', ['writing']), defaults)).toEqual({
      ...NONE,
      verified: true,
      default: true,
    });
    expect(modelLabels('writing', 'venice', model('venice', ['writing'], true), defaults)).toEqual({
      verified: true,
      unrestricted: true,
      default: false,
      adultDefault: true,
    });
    expect(modelLabels('vision', 'claude', model('claude', ['writing']), defaults)).toEqual(NONE);
    expect(modelLabels('vision', 'gemma', model('gemma', ['vision'], true), defaults)).toEqual({
      verified: true,
      unrestricted: true,
      default: true,
      adultDefault: true,
    });
  });

  it('has only its defaults for a model Venice dropped, and none while the defaults load', () => {
    expect(modelLabels('writing', 'gone', null, defaults)).toEqual(NONE);
    // a dropped model that is still a default keeps that label
    expect(modelLabels('writing', 'claude', null, defaults)).toEqual({ ...NONE, default: true });
    expect(modelLabels('writing', 'claude', model('claude', ['writing']), null)).toEqual(NONE);
  });
});
