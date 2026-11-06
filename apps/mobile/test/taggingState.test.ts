import { describe, expect, it } from 'vitest';

import type { TagAttempt } from '../src/features/photo-tags/tagAttempts';
import taggingState from '../src/features/photo-tags/taggingState';

const never = { id: 'a', tags: null };
const tagged = { id: 'b', tags: [] };
const notRun = () => false;
const attempt = (status: TagAttempt['status']): TagAttempt => ({
  status,
  error: status === 'error' ? 'Boom' : null,
  promise: new Promise<string[]>(() => {}),
});

describe('taggingState', () => {
  it('a photo never tagged counts as tagging while the assistant is available', () => {
    expect(taggingState([never], {}, true, notRun)).toEqual({ isTagging: true, untagged: [] });
  });

  it('a photo never tagged waits for a tap while the assistant is unavailable', () => {
    expect(taggingState([never], {}, false, notRun)).toEqual({ isTagging: false, untagged: [never] });
  });

  it('a tagged photo is neither tagging nor untagged', () => {
    for (const isAvailable of [true, false]) {
      expect(taggingState([tagged], {}, isAvailable, notRun)).toEqual({ isTagging: false, untagged: [] });
    }
  });

  it('a tagging under way counts as tagging', () => {
    expect(taggingState([never], { a: attempt('loading') }, false, notRun)).toEqual({ isTagging: true, untagged: [] });
  });

  it('a failed tagging waits for Tag again, not tagging nor untagged', () => {
    for (const isAvailable of [true, false]) {
      expect(taggingState([never], { a: attempt('error') }, isAvailable, notRun)).toEqual({
        isTagging: false,
        untagged: [],
      });
    }
  });

  it('a photo tried in this app run is neither tagging nor untagged while its tags are on their way', () => {
    for (const isAvailable of [true, false]) {
      expect(taggingState([never], {}, isAvailable, () => true)).toEqual({ isTagging: false, untagged: [] });
    }
  });
});
