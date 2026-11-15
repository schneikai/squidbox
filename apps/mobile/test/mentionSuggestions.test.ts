import { describe, expect, it } from 'vitest';

import type { MentionContact } from '../src/features/post-mentions/mentionHandle';
import mentionSuggestionsOf, { mentionEntries } from '../src/features/post-mentions/mentionSuggestions';

function contact(fields: Partial<MentionContact> & Pick<MentionContact, 'name'>): MentionContact {
  return { id: fields.name, isFavorite: false, avatarFilename: null, ...fields };
}

const NONE = new Set<string>();

const mentionSuggestions = (contacts: MentionContact[], onPhotoIds: Set<string>, query: string) =>
  mentionSuggestionsOf(mentionEntries(contacts), onPhotoIds, query);

const shown = (suggestions: ReturnType<typeof mentionSuggestions>) =>
  suggestions.map(({ contact: { name }, handlesText }) => `${name}: ${handlesText}`);
const names = (suggestions: ReturnType<typeof mentionSuggestions>) => suggestions.map(({ contact: { name } }) => name);

describe('mentionSuggestions', () => {
  it('ranks a name (or a word of it) starting with the query over a handle starting with it, over a match anywhere', () => {
    const contacts = [
      contact({ name: 'Jo Outtrail', xHandle: 'jo' }),
      contact({ name: 'Nora Lake', xHandle: 'trailnora' }),
      contact({ name: 'Sam Trailmix', xHandle: 'sammy_t' }),
    ];
    expect(names(mentionSuggestions(contacts, NONE, 'Trail'))).toEqual(['Sam Trailmix', 'Nora Lake', 'Jo Outtrail']);
  });

  it('shows a contact once, with each handle once and the networks it is on, without the @ it was typed with', () => {
    const contacts = [
      contact({ name: 'Mike', xHandle: '@Ridge', blueskyHandle: 'ridge', instagramHandle: 'ridge.pics' }),
    ];
    expect(shown(mentionSuggestions(contacts, NONE, 'ri'))).toEqual([
      'Mike: @Ridge on X and Bluesky · @ridge.pics on Instagram',
    ]);
  });

  it('puts favorites first among equal matches, then goes by name', () => {
    const contacts = [contact({ name: 'Bea' }), contact({ name: 'Al' }), contact({ name: 'Cy', isFavorite: true })];
    expect(names(mentionSuggestions(contacts, NONE, ''))).toEqual(['Cy', 'Al', 'Bea']);
  });

  it("puts the contacts on the post's photos first, however they match", () => {
    const contacts = [
      contact({ name: 'Theo', xHandle: 'theo' }),
      contact({ name: 'Sam Kim', xHandle: 'samtheo' }),
      contact({ name: 'Al', xHandle: 'al' }),
    ];
    const onPhotos = new Set(['Sam Kim']);
    expect(names(mentionSuggestions(contacts, onPhotos, 'theo'))).toEqual(['Sam Kim', 'Theo']);
    expect(names(mentionSuggestions(contacts, onPhotos, ''))).toEqual(['Sam Kim', 'Al', 'Theo']);
  });

  it('matches a name blind to case and accents, as a contact search does', () => {
    const contacts = [contact({ name: 'Jonas Müller' }), contact({ name: 'João' })];
    expect(names(mentionSuggestions(contacts, NONE, 'muell'))).toEqual(['Jonas Müller']);
    expect(names(mentionSuggestions(contacts, NONE, 'joa'))).toEqual(['João']);
  });

  it('lists a contact without handles (a link that is no profile is none), and leaves out those that match nothing', () => {
    const contacts = [
      contact({ name: 'Fan' }),
      contact({ name: 'Ivy', xHandle: 'https://x.com/i/lists/1' }),
      contact({ name: 'Zed', xHandle: 'zed' }),
    ];
    expect(shown(mentionSuggestions(contacts, NONE, 'fa'))).toEqual(['Fan: No handles']);
    expect(shown(mentionSuggestions(contacts, NONE, 'iv'))).toEqual(['Ivy: No handles']);
  });
});
