import { modelLabelLocks, unrestrictedLock, type ModelDefaults } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

const DEFAULTS: ModelDefaults = {
  writing: { regular: 'w-regular', unrestricted: 'w-adult' },
  vision: { regular: 'v-regular', unrestricted: 'both-adult' },
};
const locks = (modelId: string, kind: 'writing' | 'vision' = 'writing') =>
  modelLabelLocks({ kind, modelId, defaults: DEFAULTS });
const open = { defaultName: null };

describe('modelLabelLocks', () => {
  it('leaves every label of a model that is no default free to change', () => {
    expect(locks('other')).toEqual({ verified: open, unrestricted: open, default: open, adultDefault: open });
  });

  it("keeps a default's Verified on, and a default on until another model takes it", () => {
    expect(locks('w-regular')).toEqual({
      verified: { defaultName: 'Default' },
      unrestricted: open,
      default: { defaultName: 'Default' },
      adultDefault: open,
    });
    expect(locks('w-adult')).toEqual({
      verified: { defaultName: 'Default for Adult content' },
      unrestricted: { defaultName: 'Default for Adult content' },
      default: open,
      adultDefault: { defaultName: 'Default for Adult content' },
    });
  });

  it("keeps Unrestricted on for the other kind's Default for Adult content, and names that kind", () => {
    expect(locks('both-adult')).toMatchObject({
      verified: open,
      unrestricted: { defaultName: 'Vision Default for Adult content' },
    });
    expect(locks('both-adult', 'vision').unrestricted.defaultName).toBe('Default for Adult content');
  });

  it('names the kind of a Default for Adult content when the caller has none', () => {
    expect(unrestrictedLock(null, 'w-adult', DEFAULTS)).toEqual({ defaultName: 'Writing Default for Adult content' });
    expect(unrestrictedLock(null, 'other', DEFAULTS)).toEqual(open);
  });
});
