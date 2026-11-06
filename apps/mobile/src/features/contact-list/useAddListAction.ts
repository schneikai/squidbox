import { CONTACT_LIST_LIMITS, type ContactListRecord } from '@squidbox/shared';
import { Alert } from 'react-native';

import useContacts from '@/features/contacts-context/useContacts';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// Asks for a name and adds an empty contact list with it at once; `onAdded(list)` gets the new list.
// `message` goes under the prompt's title (a sheet says the list is made now, not on its Save).
type AddListOptions = { onAdded?: (list: ContactListRecord) => void; message?: string };

export default function useAddListAction({ onAdded, message }: AddListOptions = {}): () => void {
  const { addList } = useContacts();

  return function promptAddList() {
    Alert.prompt('List name', message, async (name: string) => {
      if (!name?.trim()) return;
      let list: ContactListRecord;
      try {
        list = await addList(name.trim().slice(0, CONTACT_LIST_LIMITS.name));
      } catch (error) {
        Alert.alert("Couldn't add the list", apiErrorMessage(error));
        return;
      }
      onAdded?.(list);
    });
  };
}
