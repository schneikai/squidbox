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
    expect(modelLabels('writing', model('claude', ['writing']), defaults)).toEqual({
      ...NONE,
      verified: true,
      default: true,
    });
    expect(modelLabels('writing', model('venice', ['writing'], true), defaults)).toEqual({
      verified: true,
      unrestricted: true,
      default: false,
      adultDefault: true,
    });
    expect(modelLabels('vision', model('claude', ['writing']), defaults)).toEqual(NONE);
    expect(modelLabels('vision', model('gemma', ['vision'], true), defaults)).toEqual({
      verified: true,
      unrestricted: true,
      default: true,
      adultDefault: true,
    });
  });

  it('has none for a model Venice dropped or while the defaults load', () => {
    expect(modelLabels('writing', null, defaults)).toEqual(NONE);
    expect(modelLabels('writing', model('claude', ['writing']), null)).toEqual(NONE);
  });
});
