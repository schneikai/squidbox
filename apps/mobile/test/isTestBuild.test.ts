import { describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ extra: {} as { buildProfile?: string } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: config } }));

const { default: isTestBuild } = await import('../src/features/model-compare/isTestBuild');

describe('isTestBuild', () => {
  it.each([
    ['development', true],
    ['preview', true],
    ['production', false],
    ['prod', false],
  ])('%s → %s', (buildProfile, expected) => {
    config.extra = { buildProfile };
    expect(isTestBuild()).toBe(expected);
  });

  it('is a release when the profile is unset', () => {
    config.extra = {};
    expect(isTestBuild()).toBe(false);
  });
});
