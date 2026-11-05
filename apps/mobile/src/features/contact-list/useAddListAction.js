import { Alert } from 'react-native';

import useContacts from '@/features/contacts-context/useContacts';

// Asks for a name and adds an empty contact list with it; `onAdded(list)` gets the new list.
export default function useAddListAction({ onAdded } = {}) {
  const { addList } = useContacts();

  return function promptAddList() {
    Alert.prompt('List name', undefined, async (name) => {
      if (!name?.trim()) return;
      const list = await addList(name.trim());
      onAdded?.(list);
    });
  };
}
