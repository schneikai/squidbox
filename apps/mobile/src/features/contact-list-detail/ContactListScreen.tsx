import { useLocalSearchParams } from 'expo-router';

import ContactList from './ContactList';

import { builtInContactList } from '@/features/contact-list/builtInContactLists';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import { schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';

export default function ContactListScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const builtIn = builtInContactList(listId);
  if (builtIn) return <ContactList builtIn={builtIn} />;
  return <UserContactListScreen listId={listId} />;
}

// A list of the user's, closing once it is deleted.
function UserContactListScreen({ listId }: { listId: string }) {
  const list = useLiveRecord(schema.contactLists, listId);
  useCloseWhenGone(list, 'This list was deleted');

  if (!list) return null;

  return <ContactList list={list} />;
}
