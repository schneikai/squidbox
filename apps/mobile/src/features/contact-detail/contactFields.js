import { CONTACT_HANDLES, CONTACT_HANDLE_FIELDS, normalizeHandle } from '@squidbox/shared';

import noteText from '@/utils/noteText';

/** The handle rows of a contact's form, in order: the field, its label and its placeholder. */
export const HANDLE_FIELDS = [
  ...CONTACT_HANDLES.map(({ field, label, placeholder }) => ({ field, label, placeholder })),
  { field: 'phoneNumber', label: 'Phone', placeholder: '+1 604 555 0142' },
];

const handlesOf = (valueOf) => Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, valueOf(field)]));

/** A contact's form as typed, from the stored contact (or nothing, for a new one). */
export function contactDraft(contact) {
  return {
    name: contact?.name ?? '',
    ...handlesOf((field) => contact?.[field] ?? ''),
    phoneNumber: contact?.phoneNumber ?? '',
    places: contact?.places ?? [],
    notes: contact?.notes ?? '',
  };
}

/**
 * The fields a form stores (contactDraft's, as typed): the name trimmed, each handle normalized
 * (normalizeHandle), the phone number and notes trimmed, empty rows and places left out as null.
 */
export function storedContactFields(draft) {
  const handle = (text) => normalizeHandle(text) || null;
  return {
    name: draft.name.trim(),
    ...handlesOf((field) => handle(draft[field])),
    phoneNumber: draft.phoneNumber.trim() || null,
    places: draft.places.map((place) => place.trim()).filter(Boolean),
    notes: noteText(draft.notes),
  };
}
