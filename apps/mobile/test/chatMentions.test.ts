import { CHAT_LIMITS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import chatMentions from '../src/features/post-chat/chatMentions';

const contact = (id: string, name = id) => ({ id, name });

describe('chatMentions', () => {
  it('is the added contacts, then the found ones without the removed ones, each once', () => {
    const [sam, maya, theo] = [contact('sam'), contact('maya'), contact('theo')];
    expect(chatMentions([sam, maya, theo], [theo], ['sam'])).toEqual([theo, maya]);
  });

  it('leaves out a contact whose name is too long to send and keeps at most CHAT_LIMITS.mentions', () => {
    const many = Array.from({ length: CHAT_LIMITS.mentions + 1 }, (_, index) => contact(`c${index}`));
    const long = contact('long', 'x'.repeat(CHAT_LIMITS.mention + 1));
    expect(chatMentions([long, ...many], [], [])).toEqual(many.slice(0, CHAT_LIMITS.mentions));
  });

  it('keeps an added contact when the found ones fill the limit', () => {
    const many = Array.from({ length: CHAT_LIMITS.mentions }, (_, index) => contact(`c${index}`));
    expect(chatMentions(many, [contact('sam')], [])).toContainEqual(contact('sam'));
  });
});
