import { describe, expect, it } from 'vitest';

import applyPersonaDraft from '../src/features/voice/applyPersonaDraft';

const empty = { aboutYou: '', tone: ' ', useEmoji: false, contentTags: [], rules: [], pickedPosts: [] };
const posts = ['First light on the ridge.', 'Fog on the lake 🌲', 'Back home 🇩🇪', 'Hills, then coffee.'];
const reply = {
  aboutYou: 'Outdoor guy.',
  contentTags: ['hiking', 'forest'],
  tone: 'Short.',
  examplePostIndexes: [3, 0],
};

describe('applyPersonaDraft', () => {
  it('fills an empty draft, and picks the posts verbatim from the indexes', () => {
    expect(applyPersonaDraft(empty, reply, posts, 'empty')).toEqual({
      aboutYou: 'Outdoor guy.',
      tone: 'Short.',
      useEmoji: true,
      contentTags: ['hiking', 'forest'],
      rules: [],
      pickedPosts: ['Hills, then coffee.', 'First light on the ridge.'],
    });
  });

  it('fills only the empty fields, and keeps the rules', () => {
    const draft = { ...empty, aboutYou: 'Mine.', rules: ['No hashtags'], pickedPosts: ['My post'] };
    expect(applyPersonaDraft(draft, reply, posts, 'empty')).toEqual({
      aboutYou: 'Mine.',
      tone: 'Short.',
      useEmoji: false,
      contentTags: ['hiking', 'forest'],
      rules: ['No hashtags'],
      pickedPosts: ['My post'],
    });
  });

  it('replaces every drafted field, and still keeps the rules', () => {
    const draft = { ...empty, aboutYou: 'Mine.', rules: ['No hashtags'], pickedPosts: ['My post'], useEmoji: true };
    expect(applyPersonaDraft(draft, reply, posts.slice(0, 1), 'replace')).toEqual({
      aboutYou: 'Outdoor guy.',
      tone: 'Short.',
      useEmoji: false,
      contentTags: ['hiking', 'forest'],
      rules: ['No hashtags'],
      pickedPosts: ['First light on the ridge.'],
    });
  });

  it('finds emoji: none in a plain post, one in a post with 🌲, one in a flag', () => {
    const useEmoji = (sent: string[]) =>
      applyPersonaDraft(empty, { ...reply, examplePostIndexes: [] }, sent, 'empty').useEmoji;
    expect(useEmoji(['First light on the ridge.'])).toBe(false);
    expect(useEmoji(['Fog on the lake 🌲'])).toBe(true);
    expect(useEmoji(['Back home 🇩🇪'])).toBe(true);
  });

  it('picks nothing from posts sent from Favorites, which are there already', () => {
    expect(applyPersonaDraft(empty, reply, posts, 'replace', true)).toMatchObject({
      aboutYou: 'Outdoor guy.',
      useEmoji: true,
      pickedPosts: [],
    });
  });
});
