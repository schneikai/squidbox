import {
  CONTACT_HANDLES,
  CONTACT_HANDLE_BY_FIELD,
  CONTACT_HANDLE_FIELDS,
  CONTACT_PLACE_PARTS,
  type ContactHandleField,
  type ContactPlace,
  type ContactRecord,
  normalizeHandle,
  placeParts,
} from '@squidbox/shared';

import noteText from '@/utils/noteText';

/** A row of a contact's form that holds a handle or the phone number. */
export type HandleFormField = ContactHandleField | 'phoneNumber';

/** A contact's form as typed (contactDraft). */
export type ContactDraft = Record<HandleFormField, string> & { name: string; places: ContactPlace[]; notes: string };

/** What a contact's form stores (storedContactFields). */
export type ContactFormFields = Pick<ContactRecord, 'name' | HandleFormField | 'places' | 'notes'>;

/** The handle rows of a contact's form, in order: the field, its label and its placeholder. */
export const HANDLE_FIELDS: { field: HandleFormField; label: string; placeholder: string }[] = [
  ...CONTACT_HANDLES.map(({ field, label, placeholder }) => ({ field, label, placeholder })),
  { field: 'phoneNumber', label: 'Phone', placeholder: 'Phone number' },
];

/** A stored handle as its field shows it: with `@` on a network that writes it so (X, Bluesky). */
export function handleText(field: HandleFormField, handle: string | null | undefined): string {
  const bare = handle?.replace(/^@+/, '') ?? '';
  return bare && field !== 'phoneNumber' && CONTACT_HANDLE_BY_FIELD[field].isAtHandle ? `@${bare}` : bare;
}

function handlesOf<T>(valueOf: (field: ContactHandleField) => T): Record<ContactHandleField, T> {
  return Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, valueOf(field)])) as Record<
    ContactHandleField,
    T
  >;
}

/** A place as a form holds it before anything is typed. */
export const EMPTY_PLACE: ContactPlace = { city: '', state: '', country: '' };

/** A place's parts trimmed, or null when none is left. */
export function storedPlace(place: Partial<ContactPlace> | string | null | undefined): ContactPlace | null {
  const parts = placeParts(place);
  const trimmed: ContactPlace = { city: parts.city.trim(), state: parts.state.trim(), country: parts.country.trim() };
  return CONTACT_PLACE_PARTS.some((part) => trimmed[part]) ? trimmed : null;
}

/** A contact's form as typed, from the stored contact (or nothing, for a new one). */
export function contactDraft(contact?: Partial<ContactRecord> | null): ContactDraft {
  return {
    name: contact?.name ?? '',
    ...handlesOf((field) => handleText(field, contact?.[field])),
    phoneNumber: contact?.phoneNumber ?? '',
    places: (contact?.places ?? []).map(placeParts),
    notes: contact?.notes ?? '',
  };
}

/**
 * The fields a form stores (contactDraft's, as typed): the name trimmed, each handle normalized
 * (normalizeHandle), the phone number and notes trimmed, each place's parts trimmed; empty rows as
 * null, empty places left out.
 */
export function storedContactFields(draft: ContactDraft): ContactFormFields {
  const handle = (text: string) => normalizeHandle(text) || null;
  return {
    name: draft.name.trim(),
    ...handlesOf((field) => handle(draft[field])),
    phoneNumber: draft.phoneNumber.trim() || null,
    places: draft.places.map(storedPlace).filter((place): place is ContactPlace => place !== null),
    notes: noteText(draft.notes),
  };
}
