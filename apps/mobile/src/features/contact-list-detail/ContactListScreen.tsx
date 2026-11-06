import { useLocalSearchParams } from 'expo-router';

import ContactList from './ContactList';

import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import { schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';

export default function ContactListScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const list = useLiveRecord<schema.ContactListRow>(schema.contactLists, listId);
  useCloseWhenGone(list, 'This list was deleted');

  if (!list) return null;

  return <ContactList list={list} />;
}
