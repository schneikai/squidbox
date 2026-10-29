import { modelLabelLocks, unrestrictedLock, type ModelDefaults } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

const DEFAULTS: ModelDefaults = {
  writing: { regular: 'w-regular', unrestricted: 'w-adult' },
  vision: { regular: 'v-regular', unrestricted: 'both-adult' },
};
const locks = (modelId: string, isVerified = true, isUncensored = true, kind: 'writing' | 'vision' = 'writing') =>
  modelLabelLocks({ kind, modelId, isVerified, isUncensored, defaults: DEFAULTS });
const open = { locked: false, reason: null };

describe('modelLabelLocks', () => {
  it('leaves every label of a verified, unrestricted model that is no default free to change', () => {
    expect(locks('other')).toEqual({ verified: open, unrestricted: open, default: open, adultDefault: open });
  });

  it('asks for Verified, then Unrestricted, before a default', () => {
    expect(locks('other', false, false)).toMatchObject({
      default: { locked: true, reason: 'Turn on Verified first' },
      adultDefault: { locked: true, reason: 'Turn on Verified first' },
    });
    expect(locks('other', true, false)).toMatchObject({
      default: open,
      adultDefault: { locked: true, reason: 'Turn on Unrestricted first' },
    });
  });

  it("keeps a default's Verified on, and a default on until another model takes it", () => {
    expect(locks('w-regular')).toMatchObject({
      verified: { locked: true, reason: "It's the Default" },
      default: { locked: true, reason: null },
      unrestricted: open,
    });
    expect(locks('w-adult')).toMatchObject({
      verified: { locked: true, reason: "It's the Default for Adult content" },
      unrestricted: { locked: true, reason: "It's the Default for Adult content" },
      adultDefault: { locked: true, reason: null },
    });
  });

  it("keeps Unrestricted on for the other kind's Default for Adult content, and names that kind", () => {
    expect(locks('both-adult')).toMatchObject({
      verified: open,
      unrestricted: { locked: true, reason: "It's the Vision Default for Adult content" },
    });
    expect(locks('both-adult', true, true, 'vision').unrestricted.reason).toBe("It's the Default for Adult content");
  });

  it('names the kind of a Default for Adult content when the caller has none', () => {
    expect(unrestrictedLock(null, 'w-adult', DEFAULTS)).toEqual({
      locked: true,
      reason: "It's the Writing Default for Adult content",
    });
    expect(unrestrictedLock(null, 'other', DEFAULTS)).toEqual(open);
  });
});
