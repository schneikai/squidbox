import { CHAT_LIMITS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import chatMentions from '../src/features/post-chat/chatMentions';

describe('chatMentions', () => {
  it("is the added handles, then the posts' without the removed ones, each once in any case", () => {
    const handles = ['@trailmike', '@corntwee', '@saunaboyz'];
    expect(chatMentions(handles, { added: ['@Ridge', '@CornTwee'], removed: ['@TRAILMIKE'] })).toEqual([
      '@Ridge',
      '@CornTwee',
      '@saunaboyz',
    ]);
  });

  it('leaves out a handle too long to send and keeps at most CHAT_LIMITS.mentions', () => {
    const many = Array.from({ length: CHAT_LIMITS.mentions + 1 }, (_, index) => `@h${index}`);
    const long = `@${'x'.repeat(CHAT_LIMITS.mention)}`;
    expect(chatMentions([long, ...many], { added: [], removed: [] })).toEqual(many.slice(0, CHAT_LIMITS.mentions));
  });

  it('keeps an added handle when the posts fill the limit', () => {
    const many = Array.from({ length: CHAT_LIMITS.mentions }, (_, index) => `@h${index}`);
    expect(chatMentions(many, { added: ['@ridge'], removed: [] })).toContain('@ridge');
  });
});
