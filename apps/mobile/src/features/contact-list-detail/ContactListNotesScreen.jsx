import { CONTACT_LIST_LIMITS } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';

import NotesEditSheet from '@/components/NotesEditSheet';
import useContacts from '@/features/contacts-context/useContacts';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import { schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';

// A contact list's notes as a draft sheet, saved on Save, like an album's.
export default function ContactListNotesScreen() {
  const { listId } = useLocalSearchParams();
  const list = useLiveRecord(schema.contactLists, listId);
  const { updateList } = useContacts();
  useCloseWhenGone(list, 'This list was deleted');

  if (!list) return null;

  return (
    <NotesEditSheet
      notes={list.notes}
      maxLength={CONTACT_LIST_LIMITS.notes}
      onSave={(notes) => updateList(list.id, { notes })}
    />
  );
}
