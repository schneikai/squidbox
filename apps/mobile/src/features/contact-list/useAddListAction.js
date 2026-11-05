import { CONTACT_LIST_LIMITS } from '@squidbox/shared';
import { Alert } from 'react-native';

import useContacts from '@/features/contacts-context/useContacts';

// Asks for a name and adds an empty contact list with it at once; `onAdded(list)` gets the new list.
// `message` goes under the prompt's title (a sheet says the list is made now, not on its Save).
export default function useAddListAction({ onAdded, message } = {}) {
  const { addList } = useContacts();

  return function promptAddList() {
    Alert.prompt('List name', message, async (name) => {
      if (!name?.trim()) return;
      const list = await addList(name.trim().slice(0, CONTACT_LIST_LIMITS.name));
      onAdded?.(list);
    });
  };
}
