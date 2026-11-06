import { describe, expect, it } from 'vitest';

import type { TagAttempt } from '../src/features/photo-tags/tagAttempts';
import taggingState from '../src/features/photo-tags/taggingState';

const never = { id: 'a', tags: null };
const notRun = () => false;
const attempt = (status: TagAttempt['status']): TagAttempt => ({
  status,
  error: status === 'error' ? 'Boom' : null,
  promise: new Promise<string[]>(() => {}),
});

describe('taggingState', () => {
  it('a photo never tagged is tagging while the assistant is available, and waits for a tap otherwise', () => {
    expect(taggingState([never], {}, true, notRun)).toEqual({ isTagging: true, untagged: [] });
    expect(taggingState([never], {}, false, notRun)).toEqual({ isTagging: false, untagged: [never] });
    const tagged = { id: 'b', tags: [] };
    expect(taggingState([tagged], {}, true, notRun)).toEqual({ isTagging: false, untagged: [] });
    expect(taggingState([tagged], {}, false, notRun)).toEqual({ isTagging: false, untagged: [] });
  });

  it('a tagging under way counts; a failed one, or one tagged in this run, waits for Tag again', () => {
    expect(taggingState([never], { a: attempt('loading') }, false, notRun)).toEqual({ isTagging: true, untagged: [] });
    for (const isAvailable of [true, false]) {
      expect(taggingState([never], { a: attempt('error') }, isAvailable, notRun)).toEqual({
        isTagging: false,
        untagged: [],
      });
      expect(taggingState([never], {}, isAvailable, () => true)).toEqual({ isTagging: false, untagged: [] });
    }
  });
});
