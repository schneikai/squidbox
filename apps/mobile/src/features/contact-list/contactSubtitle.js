const HANDLES = ['xHandle', 'blueskyHandle', 'onlyFansHandle', 'jffHandle'];

/** A contact row's subtitle, "place · @handle": its first place and its first handle, either left out when missing. */
export default function contactSubtitle(contact) {
  const handle = HANDLES.map((name) => contact[name]).find(Boolean);
  return [contact.places[0], handle && `@${handle}`].filter(Boolean).join(' · ');
}
