import {
  CONTACT_HANDLES,
  CONTACT_HANDLE_FIELDS,
  type ContactHandleField,
  type ContactPlace,
  type ContactRecord,
  placeParts,
} from '@squidbox/shared';

import storedPlace from '@/utils/contacts/storedPlace';
import noteText from '@/utils/noteText';

/** A row of a contact's form that holds a handle or the phone number. */
export type HandleFormField = ContactHandleField | 'phoneNumber';

/** What filled a form's fields, for the fill's note: a screenshot (From screenshot, `assistant`) or a link (From link). */
export type FillSource = 'assistant' | 'link';

/** A contact's form as typed (contactDraft). */
export type ContactDraft = Record<HandleFormField, string> & { name: string; places: ContactPlace[]; notes: string };

/** What a contact's form stores (storedContactFields). */
export type ContactFormFields = Pick<ContactRecord, 'name' | HandleFormField | 'places' | 'notes'>;

/** The handle rows of a contact's form, in order: the field, its label and its placeholder. */
export const HANDLE_FIELDS: { field: HandleFormField; label: string; placeholder: string }[] = [
  ...CONTACT_HANDLES.map(({ field, label, placeholder }) => ({ field, label, placeholder })),
  { field: 'phoneNumber', label: 'Phone', placeholder: 'Phone number' },
];

function handlesOf<T>(valueOf: (field: ContactHandleField) => T): Record<ContactHandleField, T> {
  return Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, valueOf(field)])) as Record<
    ContactHandleField,
    T
  >;
}

/** A place as a form holds it before anything is typed. */
export const EMPTY_PLACE: ContactPlace = { city: '', state: '', country: '' };

/** A contact's form as typed, from the stored contact (or nothing, for a new one). */
export function contactDraft(contact?: Partial<ContactRecord> | null): ContactDraft {
  return {
    name: contact?.name ?? '',
    ...handlesOf((field) => contact?.[field] ?? ''),
    phoneNumber: contact?.phoneNumber ?? '',
    places: (contact?.places ?? []).map(placeParts),
    notes: contact?.notes ?? '',
  };
}

/**
 * The fields a form stores (contactDraft's, as typed): the name trimmed, each handle as typed,
 * trimmed, the phone number and notes trimmed, each place's parts trimmed; empty rows as null, empty
 * places left out.
 */
export function storedContactFields(draft: ContactDraft): ContactFormFields {
  return {
    name: draft.name.trim(),
    ...handlesOf((field) => draft[field].trim() || null),
    phoneNumber: draft.phoneNumber.trim() || null,
    places: draft.places.map(storedPlace).filter((place): place is ContactPlace => place !== null),
    notes: noteText(draft.notes),
  };
}

/** The place a place sheet edits, from its `?index=` param: null for a new one. */
export function placeIndex(param: string | undefined): number | null {
  return param === undefined ? null : Number(param);
}

/**
 * `current` with each of `fields` that still holds its `old` value taken to its `next` one: a field
 * edited since keeps the edit (a change from another device, an Undo of a fill).
 */
export function draftWithChanges(
  current: ContactDraft,
  fields: readonly (keyof ContactDraft)[],
  old: Partial<ContactDraft>,
  next: Partial<ContactDraft>,
): ContactDraft {
  const taken = fields.filter((field) => JSON.stringify(current[field]) === JSON.stringify(old[field]));
  return { ...current, ...Object.fromEntries(taken.map((field) => [field, next[field]])) };
}
