import { CONTACT_HANDLE_FIELDS, CONTACT_PLACE_PARTS, type ContactRecord, placeParts } from '@squidbox/shared';

// The fields a contact search runs over, with its places.
export const SEARCHED_FIELDS = ['name', ...CONTACT_HANDLE_FIELDS, 'phoneNumber'] as const;

export type SearchedContact = Pick<ContactRecord, (typeof SEARCHED_FIELDS)[number] | 'places'>;

/** The text a contact search runs over (matchingIds): the name, the handles, the phone number and each part of its places. */
export default function contactSearchText(contact: SearchedContact): string {
  const places = contact.places.flatMap((place) => CONTACT_PLACE_PARTS.map((part) => placeParts(place)[part]));
  return [...SEARCHED_FIELDS.map((name) => contact[name]), ...places].filter(Boolean).join('\n');
}
