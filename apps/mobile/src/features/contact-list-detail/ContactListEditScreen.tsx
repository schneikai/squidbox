import { CONTACT_LIST_LIMITS } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';

import NameNotesEditSheet from '@/components/NameNotesEditSheet';
import useContacts from '@/features/contacts-context/useContacts';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import { schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';

// Edit list, from the list's ⋯ menu: its name and description as a draft sheet.
export default function ContactListEditScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const list = useLiveRecord(schema.contactLists, listId);
  const { updateList } = useContacts();
  useCloseWhenGone(list, 'This list was deleted');

  if (!list) return null;

  return (
    <NameNotesEditSheet
      name={list.name}
      notes={list.notes}
      title="Edit list"
      namePlaceholder="List name"
      notesLabel="Description"
      notesPlaceholder="What this list is for"
      maxLengths={CONTACT_LIST_LIMITS}
      onSave={(changes) => updateList(list.id, changes)}
    />
  );
}
