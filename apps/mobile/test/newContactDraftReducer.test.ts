import { type ContactRead, emptyContactRead } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import filledFrom from '../src/features/contact-new/filledFrom';
import newContactDraftReducer, {
  initialNewContactDraftState,
  type NewContactDraftAction,
  type NewContactDraftState,
} from '../src/features/contact-new/newContactDraftReducer';

const read = (fields: Partial<ContactRead>): ContactRead => ({
  ...emptyContactRead(),
  ...fields,
});
const run = (actions: NewContactDraftAction[], state = initialNewContactDraftState()): NewContactDraftState =>
  actions.reduce(newContactDraftReducer, state);
const PHOTO = 'data:image/jpeg;base64,AAAA';
const linkFill = (fields: Partial<ContactRead>, photoUri?: string, id = 1): NewContactDraftAction => ({
  type: 'fill',
  id,
  source: 'link',
  fieldsFor: (draft) => filledFrom(read(fields), draft),
  photoUri,
});

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

  it('keeps the X handle set at the tap through the fill and its Undo', () => {
    const undone = run([
      { type: 'set', field: 'xHandle', value: '@mayal' },
      linkFill({ xHandle: 'mayal', name: 'Maya Lindqvist' }, PHOTO),
      { type: 'undoFill' },
    ]);
    expect(undone.draft.xHandle).toBe('@mayal');
    expect(undone.draft.name).toBe('');
    expect(undone.avatarUri).toBeNull();
  });

  it('keeps a photo picked before the fill, and its own photo out', () => {
    const filled = run([{ type: 'avatar', uri: 'file:///picked.jpg' }, linkFill({ name: 'Maya' }, PHOTO)]);
    expect(filled.avatarUri).toBe('file:///picked.jpg');
    expect(newContactDraftReducer(filled, { type: 'undoFill' }).avatarUri).toBe('file:///picked.jpg');
  });

  it('records no fill when it fills nothing', () => {
    const state = run([{ type: 'set', field: 'name', value: 'Maya' }]);
    expect(run([linkFill({ name: 'Maya' })], state)).toBe(state);
  });

  it('records a fill that brought only the photo, for its Undo', () => {
    const filled = run([linkFill({}, PHOTO)]);
    expect(filled.fill).toMatchObject({ source: 'link', fields: [] });
    expect(newContactDraftReducer(filled, { type: 'undoFill' }).avatarUri).toBeNull();
  });

  it('undoes only the fields still as filled', () => {
    const undone = run([
      linkFill({ name: 'Maya Lindqvist', onlyFansHandle: 'mayal' }),
      { type: 'set', field: 'name', value: 'Maya L.' },
      { type: 'undoFill' },
    ]);
    expect(undone.draft.name).toBe('Maya L.');
    expect(undone.draft.onlyFansHandle).toBe('');
  });

  it('undoes the photo only while it is still the fill’s', () => {
    const undone = run([
      linkFill({ name: 'Maya' }, PHOTO),
      { type: 'avatar', uri: 'file:///picked.jpg' },
      { type: 'undoFill' },
    ]);
    expect(undone.avatarUri).toBe('file:///picked.jpg');
  });

  it('replaces the first fill’s record with a second one', () => {
    const filled = run([
      linkFill({ name: 'Maya' }),
      {
        type: 'fill',
        id: 2,
        source: 'assistant',
        fieldsFor: (draft) => filledFrom(read({ jffHandle: 'mayal' }), draft),
      },
    ]);
    expect(filled.fill).toMatchObject({ source: 'assistant', fields: ['jffHandle'] });
    expect(newContactDraftReducer(filled, { type: 'undoFill' }).draft).toMatchObject({ name: 'Maya', jffHandle: '' });
  });

  it('sets the name after the handle only while the name is still empty when it lands', () => {
    const typed = run([
      { type: 'set', field: 'name', value: 'Maya' },
      { type: 'setIfEmpty', field: 'name', value: 'mayal' },
    ]);
    expect(typed.draft.name).toBe('Maya');
    expect(run([{ type: 'setIfEmpty', field: 'name', value: 'mayal' }]).draft.name).toBe('mayal');
  });

  it("extends the fill with the assistant's place in place of the profile's own, under one Undo", () => {
    const lisbon = { city: 'Lisbon', state: '', country: 'Portugal' };
    const extended = run([
      { type: 'set', field: 'places', value: [lisbon] },
      linkFill({ name: 'Maya', city: 'Squamish, BC' }),
      {
        type: 'extendFill',
        id: 1,
        fieldsFor: (draft) =>
          filledFrom(read({ city: 'Squamish', state: '', country: 'Canada', jffHandle: 'mayal' }), draft),
      },
    ]);
    expect(extended.draft.places).toEqual([{ city: 'Squamish', state: '', country: 'Canada' }, lisbon]);
    expect(extended.draft.jffHandle).toBe('mayal');
    expect(extended.fill?.fields).toEqual(['name', 'places', 'jffHandle']);
    const undone = newContactDraftReducer(extended, { type: 'undoFill' });
    expect(undone.draft).toMatchObject({ name: '', places: [lisbon], jffHandle: '' });
  });

  it('extends the fill only where the user changed nothing since', () => {
    const extended = run([
      linkFill({ name: 'Maya', city: 'Squamish, BC' }),
      { type: 'set', field: 'places', value: [{ city: 'Whistler', state: '', country: 'Canada' }] },
      { type: 'set', field: 'onlyFansHandle', value: 'typed' },
      {
        type: 'extendFill',
        id: 1,
        fieldsFor: (draft) => filledFrom(read({ city: 'Squamish', country: 'Canada', onlyFansHandle: 'mayal' }), draft),
      },
    ]);
    expect(extended.draft.places).toEqual([{ city: 'Whistler', state: '', country: 'Canada' }]);
    expect(extended.draft.onlyFansHandle).toBe('typed');
  });

  it('does not extend a fill that was undone or replaced', () => {
    const extendJff: NewContactDraftAction = {
      type: 'extendFill',
      id: 1,
      fieldsFor: (draft) => filledFrom(read({ jffHandle: 'mayal' }), draft),
    };
    expect(run([linkFill({ name: 'Maya' }), { type: 'undoFill' }, extendJff]).draft.jffHandle).toBe('');
    expect(
      run([linkFill({ name: 'Maya' }), linkFill({ onlyFansHandle: 'mayal' }, undefined, 2), extendJff]).draft.jffHandle,
    ).toBe('');
  });
});
