import { useLocalSearchParams } from 'expo-router';

import Contact from './Contact';
import useContact from './useContact';

import useCloseWhenGone from '@/hooks/useCloseWhenGone';

export default function ContactScreen() {
  const { contactId } = useLocalSearchParams();
  const contact = useContact(contactId);
  useCloseWhenGone(contact, 'This contact was deleted');

  if (!contact) return null;

  // Keyed: the form is seeded once from the contact it opened with.
  return <Contact key={contact.id} contact={contact} />;
}
