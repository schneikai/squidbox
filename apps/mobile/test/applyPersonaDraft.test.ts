import { describe, expect, it } from 'vitest';

import applyPersonaDraft from '../src/features/voice/applyPersonaDraft';

const empty = { aboutYou: '', tone: ' ', contentTags: [], rules: [], pickedPosts: [] };
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
      contentTags: ['hiking', 'forest'],
      rules: ['No hashtags'],
      pickedPosts: ['My post'],
    });
  });

  it('replaces every drafted field, and still keeps the rules', () => {
    const draft = { ...empty, aboutYou: 'Mine.', rules: ['No hashtags'], pickedPosts: ['My post'] };
    expect(applyPersonaDraft(draft, reply, posts.slice(0, 1), 'replace')).toEqual({
      aboutYou: 'Outdoor guy.',
      tone: 'Short.',
      contentTags: ['hiking', 'forest'],
      rules: ['No hashtags'],
      pickedPosts: ['First light on the ridge.'],
    });
  });

  it('picks nothing from posts sent from Favorites, which are there already', () => {
    expect(applyPersonaDraft(empty, reply, posts, 'replace', true)).toMatchObject({
      aboutYou: 'Outdoor guy.',
      pickedPosts: [],
    });
  });
});
