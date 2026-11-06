import { useLocalSearchParams } from 'expo-router';

import Contact from './Contact';

import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import { schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';

export default function ContactScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const contact = useLiveRecord<schema.ContactRow>(schema.contacts, contactId);
  useCloseWhenGone(contact, 'This contact was deleted');

  if (!contact) return null;

  // Keyed: the form is seeded once from the contact it opened with.
  return <Contact key={contact.id} contact={contact} />;
}
