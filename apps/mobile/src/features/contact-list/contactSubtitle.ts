import { CONTACT_HANDLE_FIELDS, type ContactHandleField, type ContactRecord } from '@squidbox/shared';

import contactPlace from './contactPlace';

import { handleText } from '@/features/contact-detail/contactFields';

/**
 * A contact row's subtitle, "place · handle": its first place and its first handle as the contact
 * shows it (handleText: an @ only where the service uses one), either left out when missing.
 */
export default function contactSubtitle(contact: Pick<ContactRecord, 'places' | ContactHandleField>): string {
  const field = CONTACT_HANDLE_FIELDS.find((name) => contact[name]);
  return [contactPlace(contact), field && handleText(field, contact[field])].filter(Boolean).join(' · ');
}
