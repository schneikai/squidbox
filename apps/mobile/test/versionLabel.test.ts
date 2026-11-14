import { describe, expect, it } from 'vitest';

import versionLabel from '../src/features/channels/versionLabel';

describe('versionLabel', () => {
  it("names a version on every one of the user's channels All channels", () => {
    expect(versionLabel(['bluesky', 'x', 'instagram'], ['bluesky', 'x', 'instagram']).label).toBe('All channels');
  });

  it('names a version on some of them by its channels', () => {
    expect(versionLabel(['bluesky', 'x'], ['bluesky', 'x', 'instagram'])).toEqual({
      label: 'Bluesky, X',
      accessibilityLabel: 'Bluesky and X',
    });
  });

  it("names a lone channel by its name, even when it is the user's only one", () => {
    expect(versionLabel(['bluesky'], ['bluesky']).label).toBe('Bluesky');
  });
});
