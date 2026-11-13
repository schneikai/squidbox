import { describe, it, expect } from 'vitest';
import { deployRefusals } from '../../../scripts/deployCheck.mjs';

// Commits by the contract version they hold.
const versions: Record<string, number> = { v1aaaaaaaa: 1, v2bbbbbbbb: 2 };
const versionAt = (commit: string) => versions[commit] ?? 1;
const at = (commit: string, time: number) => ({ commit, at: time });

describe('deployRefusals', () => {
  it('lets a checkout at version 1 deploy whatever else is given: it raises nothing', () => {
    expect(deployRefusals({ version: 1, liveMinimum: null, channels: null, versionAt })).toEqual([]);
  });

  it('lets a server at the live minimum deploy without reading a channel', () => {
    expect(deployRefusals({ version: 2, liveMinimum: 2, channels: null, versionAt })).toEqual([]);
  });

  it('lets a raise deploy once the newer of each channel’s update and build has the version', () => {
    const channels = [
      { name: 'preview', update: at('v2bbbbbbbb', 20), build: at('v1aaaaaaaa', 10) },
      { name: 'production', update: undefined, build: at('v2bbbbbbbb', 10) },
    ];
    expect(deployRefusals({ version: 2, liveMinimum: 1, channels, versionAt })).toEqual([]);
  });

  it('refuses, naming the channel, when its newer update holds older code than its build', () => {
    const channels = [{ name: 'preview', update: at('v1aaaaaaaa', 20), build: at('v2bbbbbbbb', 10) }];
    const [refusal, ...rest] = deployRefusals({ version: 2, liveMinimum: 1, channels, versionAt });
    expect(rest).toEqual([]);
    expect(refusal).toMatch(
      /^The preview channel runs contract version 1 \(v1aaaaaa\), below this server's 2: .*ios:update/,
    );
  });

  it('runs the proof when the live minimum is unknown, and refuses when EAS can’t be read', () => {
    const behind = [{ name: 'preview', update: undefined, build: at('v1aaaaaaaa', 10) }];
    expect(deployRefusals({ version: 2, liveMinimum: null, channels: behind, versionAt })).toHaveLength(1);
    expect(deployRefusals({ version: 2, liveMinimum: null, channels: null, versionAt })).toEqual([
      expect.stringMatching(/EAS could not be read/),
    ]);
  });

  it('doesn’t count a channel without a build: no phone runs it', () => {
    const channels = [{ name: 'production', update: at('v1aaaaaaaa', 20), build: undefined }];
    expect(deployRefusals({ version: 2, liveMinimum: 1, channels, versionAt })).toEqual([]);
  });
});
