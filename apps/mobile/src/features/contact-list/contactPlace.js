/** Where a contact is, as one line: its first place, or null. */
export default function contactPlace(contact) {
  return contact.places[0] || null;
}
