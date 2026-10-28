import { describe, expect, it } from 'vitest';

import postTags from '../src/features/post-chat/postTags';

const none = { addedTags: [], removedTags: [] };

describe('postTags', () => {
  it("is the photos' tags together, each once in any case", () => {
    const rows = [{ tags: ['forest', 'Fog'] }, { tags: ['fog', 'selfie'] }, { tags: null }];
    expect(postTags(rows, none)).toEqual(['forest', 'Fog', 'selfie']);
  });

  it('leaves out the removed tags and adds the added ones', () => {
    const rows = [{ tags: ['forest', 'selfie'] }, { tags: ['landscape'] }];
    expect(postTags(rows, { addedTags: ['campfire'], removedTags: ['SELFIE'] })).toEqual([
      'forest',
      'landscape',
      'campfire',
    ]);
  });

  it('keeps the edits for a photo added or tagged later', () => {
    const edits = { addedTags: ['campfire'], removedTags: ['selfie'] };
    expect(postTags([{ tags: null }], edits)).toEqual(['campfire']);
    expect(postTags([{ tags: ['selfie', 'ridge'] }, { tags: ['moss'] }], edits)).toEqual(['ridge', 'moss', 'campfire']);
  });
});
