import { describe, expect, it } from 'vitest';

import personaSummary from '../src/features/assistant/personaSummary';

const persona = {
  aboutYou: '29, gym guy from Berlin, a bit cocky. My fans are mostly guys.',
  contentTags: ['gym'],
  tone: 'Short.',
  useEmoji: true,
  rules: ['a', 'b', 'c'],
  examplePosts: ['x', 'y'],
};

describe('personaSummary', () => {
  it('says it is not set up before the first save', () => {
    expect(personaSummary(null)).toBe('Not set up yet. Tell it about you and your fans.');
  });

  it('gives the first sentence of About you and the counts', () => {
    expect(personaSummary(persona)).toBe('29, gym guy from Berlin, a bit cocky.\n3 rules, 2 posts to write like.');
  });

  it('pluralises the counts and leaves out a count of 0', () => {
    expect(personaSummary({ ...persona, rules: ['a'], examplePosts: [] })).toBe(
      '29, gym guy from Berlin, a bit cocky.\n1 rule.',
    );
    expect(personaSummary({ ...persona, rules: [], examplePosts: ['x'] })).toBe(
      '29, gym guy from Berlin, a bit cocky.\n1 post to write like.',
    );
  });

  it('takes the first line of About you without a full stop, and asks for it when empty', () => {
    expect(personaSummary({ ...persona, aboutYou: 'Gym guy\nfrom Berlin', rules: [], examplePosts: [] })).toBe(
      'Gym guy',
    );
    expect(personaSummary({ ...persona, aboutYou: ' ', examplePosts: [] })).toBe(
      'Not set up yet. Tell it about you and your fans.\n3 rules.',
    );
  });
});
