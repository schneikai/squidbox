import { describe, expect, it } from 'vitest';

import personaSummary from '../src/features/assistant/personaSummary';

const persona = {
  aboutYou: '34, outdoor photographer from Oregon, a bit dry. People follow for the light.',
  tone: 'Short.',
  contentTags: ['hiking'],
  rules: ['a', 'b', 'c'],
};

describe('personaSummary', () => {
  it('says it is not set up before the first save', () => {
    expect(personaSummary(null)).toBe('Not set up yet. Tell it about you and who follows you.');
  });

  it('gives the first sentence of About you and the rules', () => {
    expect(personaSummary(persona)).toBe('34, outdoor photographer from Oregon, a bit dry.\n3 rules.');
  });

  it('pluralises the rules and leaves them out when there are none', () => {
    expect(personaSummary({ ...persona, rules: ['a'] })).toBe(
      '34, outdoor photographer from Oregon, a bit dry.\n1 rule.',
    );
    expect(personaSummary({ ...persona, rules: [] })).toBe('34, outdoor photographer from Oregon, a bit dry.');
  });

  it('takes the first line of About you without a full stop, and asks for it when empty', () => {
    expect(personaSummary({ ...persona, aboutYou: 'Outdoor guy\nfrom Oregon', rules: [] })).toBe('Outdoor guy');
    expect(personaSummary({ ...persona, aboutYou: ' ' })).toBe(
      'Not set up yet. Tell it about you and who follows you.\n3 rules.',
    );
  });
});
