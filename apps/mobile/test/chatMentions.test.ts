import { describe, expect, it } from 'vitest';

import chatMentions from '../src/features/post-chat/chatMentions';

describe('chatMentions', () => {
  it("is the posts' handles without the removed ones, then the added ones, each once in any case", () => {
    const handles = ['@trailmike', '@corntwee', '@saunaboyz'];
    expect(chatMentions(handles, { added: ['@Ridge', '@CornTwee'], removed: ['@TRAILMIKE'] })).toEqual([
      '@corntwee',
      '@saunaboyz',
      '@Ridge',
    ]);
  });
});
