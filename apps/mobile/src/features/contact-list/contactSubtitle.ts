import { CONTACT_HANDLE_FIELDS, type ContactHandleField, type ContactRecord } from '@squidbox/shared';

import contactPlace from './contactPlace';

/** A contact row's subtitle, "place · @handle": its first place and its first handle, either left out when missing. */
export default function contactSubtitle(contact: Pick<ContactRecord, 'places' | ContactHandleField>): string {
  const handle = CONTACT_HANDLE_FIELDS.map((name) => contact[name]).find(Boolean);
  return [contactPlace(contact), handle && `@${handle}`].filter(Boolean).join(' · ');
}
