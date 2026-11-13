import { type ContactRecord, formatPlace } from '@squidbox/shared';

/** Where a contact is, as one line: every place ("City, Country", formatPlace) between dots, or null. */
export default function contactPlaces(contact: Pick<ContactRecord, 'places'>): string | null {
  return contact.places.map(formatPlace).filter(Boolean).join(' · ') || null;
}
