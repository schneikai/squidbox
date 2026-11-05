import { formatPlace } from '@squidbox/shared';

/** Where a contact is, as one line: its first place ("City, Country", formatPlace), or null. */
export default function contactPlace(contact) {
  return contact.places[0] ? formatPlace(contact.places[0]) : null;
}
