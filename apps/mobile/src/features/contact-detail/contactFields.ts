import {
  CONTACT_HANDLES,
  CONTACT_LIMITS,
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

/** The place a place sheet edits, from its `?index=` param: null for a new one. */
export function placeIndex(param: string | undefined): number | null {
  return param === undefined ? null : Number(param);
}

/**
 * A contact's places with the one at `index` set to `place`: added at the end when `index` is null
 * (a new place), taken out when `place` is null.
 */
export function placesWith<T>(places: readonly T[], index: number | null, place: T | null): T[] {
  if (place === null) return places.filter((_, i) => i !== index);
  if (index === null) return [...places, place];
  return places.map((p, i) => (i === index ? place : p));
}

/**
 * A contact's places as stored, with `from` (the place a sheet opened with, null for a new one) taken
 * to `to` (null to take it out), within CONTACT_LIMITS.places. `from` is found again by its value, so
 * a change to the places meanwhile (another device's) keeps the edit on its place: one gone since is
 * added at the end again, or, for a removal, stays gone.
 */
export function placesChanged(
  places: readonly (ContactPlace | string)[],
  from: ContactPlace | null,
  to: ContactPlace | null,
): ContactPlace[] {
  const key = (place: ContactPlace | string | null) => JSON.stringify(storedPlace(place));
  const index = from === null ? -1 : places.findIndex((place) => key(place) === key(from));
  const changed =
    from !== null && index === -1 && to === null ? places : placesWith(places, index === -1 ? null : index, to);
  return changed
    .map(storedPlace)
    .filter((place): place is ContactPlace => place !== null)
    .slice(0, CONTACT_LIMITS.places);
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
