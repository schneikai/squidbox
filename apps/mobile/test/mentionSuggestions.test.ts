import { describe, expect, it } from 'vitest';

import mentionSuggestions, { type MentionContact } from '../src/features/post-mentions/mentionSuggestions';

function contact(fields: Partial<MentionContact> & Pick<MentionContact, 'name'>): MentionContact {
  return { id: fields.name, isFavorite: false, avatarFilename: null, ...fields };
}

const NONE = new Set<string>();

const shown = (suggestions: ReturnType<typeof mentionSuggestions>) =>
  suggestions.map(({ handle, networks }) => `${handle} ${networks.join(',')}`);

describe('mentionSuggestions', () => {
  it('ranks a handle starting with the query over a name word, over a match anywhere', () => {
    const contacts = [
      contact({ name: 'Sam Trailmix', xHandle: 'sammy_t' }),
      contact({ name: 'Nora Lake', xHandle: 'outdoortrail' }),
      contact({ name: 'Jo Peak', xHandle: 'trailjo' }),
    ];
    expect(shown(mentionSuggestions(contacts, NONE, 'Trail'))).toEqual(['trailjo X', 'sammy_t X', 'outdoortrail X']);
  });

  it('lists a handle a contact uses on several networks once, naming them', () => {
    const contacts = [
      contact({ name: 'Mike', xHandle: 'ridge', blueskyHandle: 'Ridge', instagramHandle: 'ridge.pics' }),
    ];
    expect(shown(mentionSuggestions(contacts, NONE, 'ri'))).toEqual(['ridge X,Bluesky', 'ridge.pics Instagram']);
  });

  it('puts favorites first among equal matches, then goes by name', () => {
    const contacts = [
      contact({ name: 'Bea', xHandle: 'b1' }),
      contact({ name: 'Al', xHandle: 'b2' }),
      contact({ name: 'Cy', xHandle: 'b3', isFavorite: true }),
    ];
    expect(shown(mentionSuggestions(contacts, NONE, ''))).toEqual(['b3 X', 'b2 X', 'b1 X']);
  });

  it("puts the contacts on the post's photos first, however they match", () => {
    const contacts = [
      contact({ name: 'Theo', xHandle: 'theo' }),
      contact({ name: 'Sam Theodor', xHandle: 'samt' }),
      contact({ name: 'Al', xHandle: 'al' }),
    ];
    const onPhotos = new Set(['Sam Theodor']);
    expect(shown(mentionSuggestions(contacts, onPhotos, 'theo'))).toEqual(['samt X', 'theo X']);
    expect(shown(mentionSuggestions(contacts, onPhotos, ''))).toEqual(['samt X', 'al X', 'theo X']);
  });

  it('matches a name blind to case and accents, as a contact search does', () => {
    const contacts = [contact({ name: 'Jonas Müller', xHandle: 'jm' }), contact({ name: 'João', xHandle: 'jsilva' })];
    expect(shown(mentionSuggestions(contacts, NONE, 'muell'))).toEqual(['jm X']);
    expect(shown(mentionSuggestions(contacts, NONE, 'joa'))).toEqual(['jsilva X']);
  });

  it('leaves out contacts without a handle and those that match nothing', () => {
    const contacts = [contact({ name: 'Fan' }), contact({ name: 'Zed', xHandle: 'zed' })];
    expect(shown(mentionSuggestions(contacts, NONE, 'fa'))).toEqual([]);
  });
});
