import { describe, expect, it } from 'vitest';

import handleSuggestionsOf, { handleEntries, type HandleContact } from '../src/features/post-chat/handleSuggestions';

function contact(fields: Partial<HandleContact> & Pick<HandleContact, 'name'>): HandleContact {
  return { id: fields.name, isFavorite: false, avatarFilename: null, ...fields };
}

const NONE = new Set<string>();

const handleSuggestions = (contacts: HandleContact[], onPhotoIds: Set<string>, query: string, taken?: Set<string>) =>
  handleSuggestionsOf(handleEntries(contacts), onPhotoIds, query, taken);

const shown = (suggestions: ReturnType<typeof handleSuggestions>) =>
  suggestions.map(({ handle, networks }) => `${handle} ${networks.join(',')}`);

describe('handleSuggestions', () => {
  it('ranks a handle starting with the query over a name word, over a match anywhere', () => {
    const contacts = [
      contact({ name: 'Sam Trailmix', xHandle: 'sammy_t' }),
      contact({ name: 'Nora Lake', xHandle: 'outdoortrail' }),
      contact({ name: 'Jo Peak', xHandle: 'trailjo' }),
    ];
    expect(shown(handleSuggestions(contacts, NONE, 'Trail'))).toEqual(['trailjo X', 'sammy_t X', 'outdoortrail X']);
  });

  it('lists a handle a contact uses on several networks once, naming them, without the @ it was typed with', () => {
    const contacts = [
      contact({ name: 'Mike', xHandle: '@Ridge', blueskyHandle: 'ridge', instagramHandle: 'ridge.pics' }),
    ];
    expect(shown(handleSuggestions(contacts, NONE, 'ri'))).toEqual(['Ridge X,Bluesky', 'ridge.pics Instagram']);
  });

  it('puts favorites first among equal matches, then goes by name', () => {
    const contacts = [
      contact({ name: 'Bea', xHandle: 'b1' }),
      contact({ name: 'Al', xHandle: 'b2' }),
      contact({ name: 'Cy', xHandle: 'b3', isFavorite: true }),
    ];
    expect(shown(handleSuggestions(contacts, NONE, ''))).toEqual(['b3 X', 'b2 X', 'b1 X']);
  });

  it("puts the contacts on the post's photos first, however they match", () => {
    const contacts = [
      contact({ name: 'Theo', xHandle: 'theo' }),
      contact({ name: 'Sam Theodor', xHandle: 'samt' }),
      contact({ name: 'Al', xHandle: 'al' }),
    ];
    const onPhotos = new Set(['Sam Theodor']);
    expect(shown(handleSuggestions(contacts, onPhotos, 'theo'))).toEqual(['samt X', 'theo X']);
    expect(shown(handleSuggestions(contacts, onPhotos, ''))).toEqual(['samt X', 'al X', 'theo X']);
  });

  it('leaves out the handles already taken, so the next ones take their place', () => {
    const contacts = [
      contact({ name: 'Mike', xHandle: 'Ridge', instagramHandle: 'ridge.pics' }),
      contact({ name: 'Rita', xHandle: 'rita' }),
    ];
    expect(shown(handleSuggestions(contacts, NONE, 'ri', new Set(['ridge'])))).toEqual([
      'ridge.pics Instagram',
      'rita X',
    ]);
  });

  it('matches a name blind to case and accents, as a contact search does', () => {
    const contacts = [contact({ name: 'Jonas Müller', xHandle: 'jm' }), contact({ name: 'João', xHandle: 'jsilva' })];
    expect(shown(handleSuggestions(contacts, NONE, 'muell'))).toEqual(['jm X']);
    expect(shown(handleSuggestions(contacts, NONE, 'joa'))).toEqual(['jsilva X']);
  });

  it('leaves out contacts without a handle, a link that is no profile, and those that match nothing', () => {
    const contacts = [
      contact({ name: 'Fan' }),
      contact({ name: 'Zed', xHandle: 'zed' }),
      contact({ name: 'Ivy', xHandle: 'https://x.com/i/lists/1' }),
    ];
    expect(shown(handleSuggestions(contacts, NONE, 'fa'))).toEqual([]);
    expect(shown(handleSuggestions(contacts, NONE, 'i'))).toEqual([]);
  });
});
