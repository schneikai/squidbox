import { normalizeHandle } from '@squidbox/shared';

import noteText from '@/utils/noteText';

/** The handle rows of a contact's form, in order: the field, its label and its placeholder. */
export const HANDLE_FIELDS = [
  { field: 'xHandle', label: 'X', placeholder: 'x.com/username' },
  { field: 'blueskyHandle', label: 'Bluesky', placeholder: 'name.bsky.social' },
  { field: 'onlyFansHandle', label: 'OnlyFans', placeholder: 'onlyfans.com/username' },
  { field: 'jffHandle', label: 'JFF', placeholder: 'justfor.fans/username' },
  { field: 'phoneNumber', label: 'Phone', placeholder: '+1 604 555 0142' },
];

/** A contact's form as typed, from the stored contact (or nothing, for a new one). */
export function contactDraft(contact) {
  return {
    name: contact?.name ?? '',
    xHandle: contact?.xHandle ?? '',
    blueskyHandle: contact?.blueskyHandle ?? '',
    onlyFansHandle: contact?.onlyFansHandle ?? '',
    jffHandle: contact?.jffHandle ?? '',
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
    xHandle: handle(draft.xHandle),
    blueskyHandle: handle(draft.blueskyHandle),
    onlyFansHandle: handle(draft.onlyFansHandle),
    jffHandle: handle(draft.jffHandle),
    phoneNumber: draft.phoneNumber.trim() || null,
    places: draft.places.map((place) => place.trim()).filter(Boolean),
    notes: noteText(draft.notes),
  };
}
