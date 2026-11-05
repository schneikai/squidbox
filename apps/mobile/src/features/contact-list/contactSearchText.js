import { CONTACT_HANDLE_FIELDS } from '@squidbox/shared';

// The fields a contact search runs over, with its places.
export const SEARCHED_FIELDS = ['name', ...CONTACT_HANDLE_FIELDS, 'phoneNumber'];

/** The text a contact search runs over (matchingIds): the name, the handles, the phone number and the places. */
export default function contactSearchText(contact) {
  return [...SEARCHED_FIELDS.map((name) => contact[name]), ...contact.places].filter(Boolean).join('\n');
}
