import { describe, expect, it } from 'vitest';

import personaSummary from '../src/features/assistant/personaSummary';

const persona = {
  aboutYou: '29, gym guy from Berlin, a bit cocky. My fans are mostly guys.',
  tone: 'Short.',
  useEmoji: true,
  contentTags: ['gym'],
  rules: ['a', 'b', 'c'],
};

describe('personaSummary', () => {
  it('says it is not set up before the first save', () => {
    expect(personaSummary(null)).toBe('Not set up yet. Tell it about you and your fans.');
  });

  it('gives the first sentence of About you and the rules', () => {
    expect(personaSummary(persona)).toBe('29, gym guy from Berlin, a bit cocky.\n3 rules.');
  });

  it('pluralises the rules and leaves them out when there are none', () => {
    expect(personaSummary({ ...persona, rules: ['a'] })).toBe('29, gym guy from Berlin, a bit cocky.\n1 rule.');
    expect(personaSummary({ ...persona, rules: [] })).toBe('29, gym guy from Berlin, a bit cocky.');
  });

  it('takes the first line of About you without a full stop, and asks for it when empty', () => {
    expect(personaSummary({ ...persona, aboutYou: 'Gym guy\nfrom Berlin', rules: [] })).toBe('Gym guy');
    expect(personaSummary({ ...persona, aboutYou: ' ' })).toBe(
      'Not set up yet. Tell it about you and your fans.\n3 rules.',
    );
  });
});
