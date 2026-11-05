import { CONTACT_HANDLE_FIELDS } from '@squidbox/shared';

/** A contact row's subtitle, "place · @handle": its first place and its first handle, either left out when missing. */
export default function contactSubtitle(contact) {
  const handle = CONTACT_HANDLE_FIELDS.map((name) => contact[name]).find(Boolean);
  return [contact.places[0], handle && `@${handle}`].filter(Boolean).join(' · ');
}
