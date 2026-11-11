import { describe, expect, it } from 'vitest';

import shouldStartIdeas from '../src/features/post-ideas/shouldStartIdeas';

const ready = {
  kind: 'draft' as const,
  ideas: 'post' as const,
  isOn: true,
  hasMedia: true,
  hasStarted: false,
  isAvailable: true,
  isFirstSyncDone: true,
};

describe('shouldStartIdeas', () => {
  it("starts a new post's ideas once it has media", () => {
    expect(shouldStartIdeas(ready)).toBe(true);
    expect(shouldStartIdeas({ ...ready, hasMedia: false })).toBe(false);
  });

  it("starts a repost's ideas as it opens, media or not", () => {
    expect(shouldStartIdeas({ ...ready, ideas: 'repost', hasMedia: false })).toBe(true);
  });

  it('starts them once per sheet', () => {
    expect(shouldStartIdeas({ ...ready, hasStarted: true })).toBe(false);
  });

  it('never starts them with the switch off or still reading, before the first sync, or without the assistant', () => {
    for (const change of [{ isOn: false }, { isOn: undefined }, { isFirstSyncDone: false }, { isAvailable: false }]) {
      expect(shouldStartIdeas({ ...ready, ...change })).toBe(false);
    }
  });

  it('never starts them for an edit or a posted post', () => {
    for (const kind of ['edit', 'post'] as const) expect(shouldStartIdeas({ ...ready, kind })).toBe(false);
  });
});
