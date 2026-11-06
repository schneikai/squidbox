import { type ContactRead, emptyContactRead } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import type { ContactDraft } from '../src/features/contact-detail/contactFields';
import filledFrom from '../src/features/contact-new/filledFrom';
import initialNewContactDraftState from '../src/features/contact-new/initialNewContactDraftState';
import newContactDraftReducer, {
  type NewContactDraftAction,
  type NewContactDraftState,
} from '../src/features/contact-new/newContactDraftReducer';

const read = (fields: Partial<ContactRead>): ContactRead => ({ ...emptyContactRead(), ...fields });
const run = (actions: NewContactDraftAction[], state = initialNewContactDraftState()): NewContactDraftState =>
  actions.reduce(newContactDraftReducer, state);
const PHOTO = 'data:image/jpeg;base64,AAAA';
const fill = (fields: Partial<ContactRead>, photoUri?: string, id = 1): NewContactDraftAction => ({
  type: 'fill',
  id,
  source: 'link',
  fieldsFor: (draft) => filledFrom(read(fields), draft),
  photoUri,
});
const extend = (
  fields: Partial<ContactRead>,
  {
    source = 'link',
    photoUri,
    onlyIntoEmpty,
    id = 1,
  }: Partial<Extract<NewContactDraftAction, { type: 'extendFill' }>> = {},
): NewContactDraftAction => ({
  type: 'extendFill',
  id,
  source,
  fieldsFor: (draft) => filledFrom(read(fields), draft),
  photoUri,
  onlyIntoEmpty,
});
// From link: the handle at the tap, then the profile the server read.
const tapLink = fill({ xHandle: 'mayal' });

describe('newContactDraftReducer', () => {
  it('fills against the draft as it is when the reading lands, so Undo brings back what was typed meanwhile', () => {
    const reading = read({ name: 'Maya Lund', city: 'Squamish', country: 'Canada' });
    // Tapped on an empty draft; the name and a place are typed while the screenshot is read.
    const filled = run([
      { type: 'set', field: 'name', value: 'Maya' },
      { type: 'set', field: 'places', value: [{ city: 'Lisbon', state: '', country: 'Portugal' }] },
      { type: 'fill', id: 1, source: 'assistant', fieldsFor: (draft) => filledFrom(reading, draft) },
    ]);
    expect(filled.draft.name).toBe('Maya Lund');
    expect(filled.draft.places).toEqual([
      { city: 'Squamish', state: '', country: 'Canada' },
      { city: 'Lisbon', state: '', country: 'Portugal' },
    ]);
    const undone = newContactDraftReducer(filled, { type: 'undoFill' });
    expect(undone.draft.name).toBe('Maya');
    expect(undone.draft.places).toEqual([{ city: 'Lisbon', state: '', country: 'Portugal' }]);
  });

  it('takes the X handle back on Undo, with the profile it brought', () => {
    const undone = run([
      { type: 'set', field: 'xHandle', value: '@old' },
      tapLink,
      extend({ xHandle: 'mayal', name: 'Maya Lindqvist' }, { photoUri: PHOTO }),
      { type: 'undoFill' },
    ]);
    expect(undone.draft).toMatchObject({ xHandle: '@old', name: '' });
    expect(undone.avatarUri).toBeNull();
  });

  it('records a fill of nothing, so the profile read after it still has it', () => {
    const extended = run([
      { type: 'set', field: 'xHandle', value: '@mayal' },
      tapLink,
      extend({ xHandle: 'mayal', name: 'Maya' }),
    ]);
    expect(extended.draft.name).toBe('Maya');
    expect(extended.fill?.fields).toEqual(['name']);
  });

  it('keeps a photo picked before the fill, and its own photo out', () => {
    const filled = run([{ type: 'avatar', uri: 'file:///picked.jpg' }, tapLink, extend({}, { photoUri: PHOTO })]);
    expect(filled.avatarUri).toBe('file:///picked.jpg');
    expect(newContactDraftReducer(filled, { type: 'undoFill' }).avatarUri).toBe('file:///picked.jpg');
  });

  it('undoes only the fields still as filled', () => {
    const undone = run([
      fill({ name: 'Maya Lindqvist', onlyFansHandle: 'mayal' }),
      { type: 'set', field: 'name', value: 'Maya L.' },
      { type: 'undoFill' },
    ]);
    expect(undone.draft.name).toBe('Maya L.');
    expect(undone.draft.onlyFansHandle).toBe('');
  });

  it('undoes the photo only while it is still the fill’s', () => {
    const undone = run([
      fill({ name: 'Maya' }, PHOTO),
      { type: 'avatar', uri: 'file:///picked.jpg' },
      { type: 'undoFill' },
    ]);
    expect(undone.avatarUri).toBe('file:///picked.jpg');
  });

  it("extends the fill with the assistant's place in place of the profile's own, marked as the assistant's, under one Undo", () => {
    const lisbon = { city: 'Lisbon', state: '', country: 'Portugal' };
    const extended = run([
      { type: 'set', field: 'places', value: [lisbon] },
      fill({ name: 'Maya', city: 'Squamish, BC' }),
      extend({ city: 'Squamish', country: 'Canada', jffHandle: 'mayal' }, { source: 'assistant', onlyIntoEmpty: true }),
    ]);
    expect(extended.draft.places).toEqual([{ city: 'Squamish', state: '', country: 'Canada' }, lisbon]);
    expect(extended.draft.jffHandle).toBe('mayal');
    expect(extended.fill?.fieldSources).toEqual({ name: 'link', places: 'assistant', jffHandle: 'assistant' });
    const undone = newContactDraftReducer(extended, { type: 'undoFill' });
    expect(undone.draft).toMatchObject({ name: '', places: [lisbon], jffHandle: '' });
  });

  it("extends the assistant's pass only where the user changed nothing since", () => {
    const extended = run([
      fill({ name: 'Maya', city: 'Squamish, BC' }),
      { type: 'set', field: 'places', value: [{ city: 'Whistler', state: '', country: 'Canada' }] },
      { type: 'set', field: 'onlyFansHandle', value: 'typed' },
      extend(
        { city: 'Squamish', country: 'Canada', onlyFansHandle: 'mayal' },
        { source: 'assistant', onlyIntoEmpty: true },
      ),
    ]);
    expect(extended.draft.places).toEqual([{ city: 'Whistler', state: '', country: 'Canada' }]);
    expect(extended.draft.onlyFansHandle).toBe('typed');
  });

  it('names the contact after the handle only while it has no name when the read lands', () => {
    const nameAfterHandle = (draft: ContactDraft) => (draft.name.trim() ? {} : { name: 'mayal' });
    const typed = run([
      tapLink,
      { type: 'set', field: 'name', value: 'Maya' },
      { type: 'extendFill', id: 1, source: 'link', fieldsFor: nameAfterHandle },
    ]);
    expect(typed.draft.name).toBe('Maya');
    const named = run([tapLink, { type: 'extendFill', id: 1, source: 'link', fieldsFor: nameAfterHandle }]);
    expect(named.draft.name).toBe('mayal');
    expect(newContactDraftReducer(named, { type: 'undoFill' }).draft.name).toBe('');
  });

  it('does not extend a fill that was undone or replaced', () => {
    const extendJff = extend({ jffHandle: 'mayal' });
    expect(run([fill({ name: 'Maya' }), { type: 'undoFill' }, extendJff]).draft.jffHandle).toBe('');
    expect(
      run([fill({ name: 'Maya' }), fill({ onlyFansHandle: 'mayal' }, undefined, 2), extendJff]).draft.jffHandle,
    ).toBe('');
  });
});
