import {
  CONTACT_HANDLE_BY_FIELD,
  CONTACT_HANDLE_FIELDS,
  CONTACT_PLACE_PARTS,
  type ContactRecord,
  placeParts,
} from '@squidbox/shared';

// The fields a contact search runs over, with its places.
export const SEARCHED_FIELDS = ['name', ...CONTACT_HANDLE_FIELDS, 'phoneNumber'] as const;

export type SearchedContact = Pick<ContactRecord, (typeof SEARCHED_FIELDS)[number] | 'places'>;

/**
 * The text a contact search runs over (matchingIds): the name, the handles, the phone number and each
 * part of its places. A handle the app shows with `@` (isAtHandle) is searched with it, as it is typed
 * or pasted ("@benclimbs"), though it is stored without; "benclimbs" still finds it.
 */
export default function contactSearchText(contact: SearchedContact): string {
  const fields = SEARCHED_FIELDS.map((name) => {
    const value = contact[name];
    return value && name !== 'name' && name !== 'phoneNumber' && CONTACT_HANDLE_BY_FIELD[name].isAtHandle
      ? `@${value}`
      : value;
  });
  const places = contact.places.flatMap((place) => {
    const parts = placeParts(place);
    return CONTACT_PLACE_PARTS.map((part) => parts[part]);
  });
  return [...fields, ...places].filter(Boolean).join('\n');
}
