import { useLocalSearchParams } from 'expo-router';

import ContactList from './ContactList';
import useContactList from './useContactList';

import useCloseWhenGone from '@/hooks/useCloseWhenGone';

export default function ContactListScreen() {
  const { listId } = useLocalSearchParams();
  const list = useContactList(listId);
  useCloseWhenGone(list, 'This list was deleted');

  if (!list) return null;

  return <ContactList list={list} />;
}
