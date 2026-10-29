import { describe, expect, it } from 'vitest';

import modelLabels from '../src/utils/ai/modelLabels';

const defaults = {
  writing: { regular: 'claude', unrestricted: 'venice' },
  vision: { regular: 'gemma', unrestricted: 'gemma' },
};
const model = (id: string, verifiedKinds: string[], isUncensored = false) => ({ id, verifiedKinds, isUncensored });
const NONE = { isVerified: false, isUnrestricted: false, isDefault: false, isAdultDefault: false };

describe('modelLabels', () => {
  it('has the labels of the model for the kind', () => {
    expect(modelLabels('writing', model('claude', ['writing']), defaults)).toEqual({
      ...NONE,
      isVerified: true,
      isDefault: true,
    });
    expect(modelLabels('writing', model('venice', ['writing'], true), defaults)).toEqual({
      isVerified: true,
      isUnrestricted: true,
      isDefault: false,
      isAdultDefault: true,
    });
    expect(modelLabels('vision', model('claude', ['writing']), defaults)).toEqual(NONE);
    expect(modelLabels('vision', model('gemma', ['vision'], true), defaults)).toEqual({
      isVerified: true,
      isUnrestricted: true,
      isDefault: true,
      isAdultDefault: true,
    });
  });

  it('has none for a model Venice dropped or while the defaults load', () => {
    expect(modelLabels('writing', null, defaults)).toEqual(NONE);
    expect(modelLabels('writing', model('claude', ['writing']), null)).toEqual(NONE);
  });
});
