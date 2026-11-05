import { CONTACT_HANDLE_FIELDS, CONTACT_PLACE_PARTS, placeParts } from '@squidbox/shared';

// The fields a contact search runs over, with its places.
export const SEARCHED_FIELDS = ['name', ...CONTACT_HANDLE_FIELDS, 'phoneNumber'];

/** The text a contact search runs over (matchingIds): the name, the handles, the phone number and each part of its places. */
export default function contactSearchText(contact) {
  const places = contact.places.flatMap((place) => CONTACT_PLACE_PARTS.map((part) => placeParts(place)[part]));
  return [...SEARCHED_FIELDS.map((name) => contact[name]), ...places].filter(Boolean).join('\n');
}
