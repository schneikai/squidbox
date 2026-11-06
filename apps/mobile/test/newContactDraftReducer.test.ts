import { CONTACT_HANDLE_FIELDS, type ContactFromScreenshotResponse, type ContactHandleField } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import { contactDraft } from '../src/features/contact-detail/contactFields';
import filledFromScreenshot from '../src/features/contact-new/filledFromScreenshot';
import newContactDraftReducer, {
  type NewContactDraftAction,
  type NewContactDraftState,
} from '../src/features/contact-new/newContactDraftReducer';

const read = (fields: Partial<ContactFromScreenshotResponse>): ContactFromScreenshotResponse => ({
  name: '',
  ...(Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, ''])) as Record<ContactHandleField, string>),
  city: '',
  state: '',
  country: '',
  ...fields,
});
const run = (actions: NewContactDraftAction[]): NewContactDraftState =>
  actions.reduce(newContactDraftReducer, { draft: contactDraft(), fill: null });

describe('newContactDraftReducer', () => {
  it('fills against the draft as it is when the reading lands, so Undo brings back what was typed meanwhile', () => {
    const reading = read({ name: 'Maya Lund', city: 'Squamish', country: 'Canada' });
    // Tapped on an empty draft; the name and a place are typed while the screenshot is read.
    const filled = run([
      { type: 'set', field: 'name', value: 'Maya' },
      { type: 'set', field: 'places', value: [{ city: 'Lisbon', state: '', country: 'Portugal' }] },
      { type: 'fill', fieldsFor: (draft) => filledFromScreenshot(reading, draft) },
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
});
