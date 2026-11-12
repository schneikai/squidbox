import { describe, expect, it } from 'vitest';

import taggingState from '../src/features/post-chat/taggingState';
import type { TagAttempt } from '../src/lib/createTagAttempts';

const never = { id: 'a', tags: null };
const tagged = { id: 'b', tags: [] };
const notRun = () => false;
const context = (isAvailable: boolean, willTag = false) => ({ isAvailable, willTag, hasRun: notRun });
const attempt = (status: TagAttempt['status']): TagAttempt => ({
  status,
  error: status === 'error' ? 'Boom' : null,
  promise: new Promise<string[]>(() => {}),
});

describe('taggingState', () => {
  it('a photo never tagged counts as tagging where it is tagged by itself (the chat screen)', () => {
    expect(taggingState([never], {}, context(true, true))).toEqual({ isTagging: true, untagged: [] });
  });

  it('a photo never tagged is neither tagging nor untagged where a turn tags it (the tray)', () => {
    expect(taggingState([never], {}, context(true))).toEqual({ isTagging: false, untagged: [] });
  });

  it('a photo never tagged waits for a tap while the assistant is unavailable', () => {
    expect(taggingState([never], {}, context(false, true))).toEqual({ isTagging: false, untagged: [never] });
  });

  it('a tagged photo is neither tagging nor untagged', () => {
    for (const isAvailable of [true, false]) {
      expect(taggingState([tagged], {}, context(isAvailable, true))).toEqual({ isTagging: false, untagged: [] });
    }
  });

  it('a tagging under way counts as tagging', () => {
    expect(taggingState([never], { a: attempt('loading') }, context(false))).toEqual({ isTagging: true, untagged: [] });
  });

  it('a failed tagging waits for Tag again, not tagging nor untagged', () => {
    for (const isAvailable of [true, false]) {
      expect(taggingState([never], { a: attempt('error') }, context(isAvailable, true))).toEqual({
        isTagging: false,
        untagged: [],
      });
    }
  });

  it('a photo tried in this app run is neither tagging nor untagged while its tags are on their way', () => {
    for (const isAvailable of [true, false]) {
      expect(taggingState([never], {}, { isAvailable, willTag: true, hasRun: () => true })).toEqual({
        isTagging: false,
        untagged: [],
      });
    }
  });
});
