import { describe, expect, it } from 'vitest';

import applyPersonaDraft from '../src/features/voice/applyPersonaDraft';

const empty = { aboutYou: '', tone: ' ', useEmoji: false, contentTags: [], rules: [], pickedPosts: [] };
const posts = ['Leg day. You’re welcome.', 'Sheets still warm 😏', 'Back home 🇩🇪', 'Gym, then you.'];
const reply = { aboutYou: 'Gym guy.', contentTags: ['gym', 'pov'], tone: 'Short.', examplePostIndexes: [3, 0] };

describe('applyPersonaDraft', () => {
  it('fills an empty draft, and picks the posts verbatim from the indexes', () => {
    expect(applyPersonaDraft(empty, reply, posts, 'empty')).toEqual({
      aboutYou: 'Gym guy.',
      tone: 'Short.',
      useEmoji: true,
      contentTags: ['gym', 'pov'],
      rules: [],
      pickedPosts: ['Gym, then you.', 'Leg day. You’re welcome.'],
    });
  });

  it('fills only the empty fields, and keeps the rules', () => {
    const draft = { ...empty, aboutYou: 'Mine.', rules: ['No hashtags'], pickedPosts: ['My post'] };
    expect(applyPersonaDraft(draft, reply, posts, 'empty')).toEqual({
      aboutYou: 'Mine.',
      tone: 'Short.',
      useEmoji: false,
      contentTags: ['gym', 'pov'],
      rules: ['No hashtags'],
      pickedPosts: ['My post'],
    });
  });

  it('replaces every drafted field, and still keeps the rules', () => {
    const draft = { ...empty, aboutYou: 'Mine.', rules: ['No hashtags'], pickedPosts: ['My post'], useEmoji: true };
    expect(applyPersonaDraft(draft, reply, posts.slice(0, 1), 'replace')).toEqual({
      aboutYou: 'Gym guy.',
      tone: 'Short.',
      useEmoji: false,
      contentTags: ['gym', 'pov'],
      rules: ['No hashtags'],
      pickedPosts: ['Leg day. You’re welcome.'],
    });
  });

  it('finds emoji: none in a plain post, one in a post with 😏, one in a flag', () => {
    const useEmoji = (sent: string[]) =>
      applyPersonaDraft(empty, { ...reply, examplePostIndexes: [] }, sent, 'empty').useEmoji;
    expect(useEmoji(['Leg day. You’re welcome.'])).toBe(false);
    expect(useEmoji(['Sheets still warm 😏'])).toBe(true);
    expect(useEmoji(['Back home 🇩🇪'])).toBe(true);
  });

  it('picks nothing from posts sent from Favorites, which are there already', () => {
    expect(applyPersonaDraft(empty, reply, posts, 'replace', true)).toMatchObject({
      aboutYou: 'Gym guy.',
      useEmoji: true,
      pickedPosts: [],
    });
  });
});
