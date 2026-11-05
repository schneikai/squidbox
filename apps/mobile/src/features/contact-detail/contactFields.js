import {
  CONTACT_HANDLES,
  CONTACT_HANDLE_BY_FIELD,
  CONTACT_HANDLE_FIELDS,
  CONTACT_PLACE_PARTS,
  normalizeHandle,
  placeParts,
} from '@squidbox/shared';

import noteText from '@/utils/noteText';

/** The handle rows of a contact's form, in order: the field, its label and its placeholder. */
export const HANDLE_FIELDS = [
  ...CONTACT_HANDLES.map(({ field, label, placeholder }) => ({ field, label, placeholder })),
  { field: 'phoneNumber', label: 'Phone', placeholder: 'Phone number' },
];

/** A stored handle as its field shows it: with `@` on a network that writes it so (X, Bluesky). */
export function handleText(field, handle) {
  const bare = handle?.replace(/^@+/, '') ?? '';
  return bare && CONTACT_HANDLE_BY_FIELD[field].isAtHandle ? `@${bare}` : bare;
}

const handlesOf = (valueOf) => Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, valueOf(field)]));

/** A place as a form holds it before anything is typed. */
export const EMPTY_PLACE = { city: '', state: '', country: '' };

/** A place's parts trimmed, or null when none is left. */
export function storedPlace(place) {
  const parts = placeParts(place);
  const trimmed = Object.fromEntries(CONTACT_PLACE_PARTS.map((part) => [part, parts[part].trim()]));
  return CONTACT_PLACE_PARTS.some((part) => trimmed[part]) ? trimmed : null;
}

/** A contact's form as typed, from the stored contact (or nothing, for a new one). */
export function contactDraft(contact) {
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
export function storedContactFields(draft) {
  const handle = (text) => normalizeHandle(text) || null;
  return {
    name: draft.name.trim(),
    ...handlesOf((field) => handle(draft[field])),
    phoneNumber: draft.phoneNumber.trim() || null,
    places: draft.places.map(storedPlace).filter(Boolean),
    notes: noteText(draft.notes),
  };
}
