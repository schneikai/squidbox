import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ extra: {} as { buildProfile?: string } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: config } }));

const { default: isTestBuild } = await import('../src/features/assistant/isTestBuild');

describe('isTestBuild', () => {
  beforeEach(() => vi.stubGlobal('__DEV__', false));
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['development', true],
    ['preview', true],
    ['production', false],
    ['prod', false],
  ])('%s → %s', (buildProfile, expected) => {
    config.extra = { buildProfile };
    expect(isTestBuild()).toBe(expected);
  });

  it('is a release when the profile is unset (a build made without EAS)', () => {
    config.extra = {};
    expect(isTestBuild()).toBe(false);
  });

  it('is a test build in a development bundle, whatever the profile', () => {
    vi.stubGlobal('__DEV__', true);
    config.extra = {};
    expect(isTestBuild()).toBe(true);
  });
});
