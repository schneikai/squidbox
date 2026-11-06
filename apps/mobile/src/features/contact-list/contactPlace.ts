import { type ContactRecord, formatPlace } from '@squidbox/shared';

/** Where a contact is, as one line: its first place ("City, Country", formatPlace), or null. */
export default function contactPlace(contact: Pick<ContactRecord, 'places'>): string | null {
  return contact.places[0] ? formatPlace(contact.places[0]) : null;
}
