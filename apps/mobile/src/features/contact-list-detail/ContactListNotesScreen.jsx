import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import useContactList from './useContactList';

import TextEditSheet from '@/components/TextEditSheet';
import useContacts from '@/features/contacts-context/useContacts';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useEditSheet from '@/hooks/useEditSheet';
import noteText from '@/utils/noteText';

// A contact list's notes as a draft sheet, saved on Save, like an album's. An emptied note saves as none.
export default function ContactListNotesScreen() {
  const { listId } = useLocalSearchParams();
  const list = useContactList(listId);
  useCloseWhenGone(list, 'This list was deleted');
  if (!list) return null;
  return <ContactListNotesEditor list={list} />;
}

// The draft starts from the notes as they were when the sheet opened.
function ContactListNotesEditor({ list }) {
  const { updateList } = useContacts();
  const [initialNotes] = useState(list.notes);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const { sheetProps, finish } = useEditSheet({
    isDirty: noteText(notes) !== noteText(initialNotes),
    save,
    syncsItself: true,
  });

  async function save() {
    await updateList(list.id, { notes: noteText(notes) });
  }

  function handleDelete() {
    finish(() => updateList(list.id, { notes: null }), "Couldn't delete the note");
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title="Notes"
      value={notes}
      onChangeText={setNotes}
      placeholder="Add a note…"
      autoFocus
      actions={noteText(initialNotes) ? [{ label: 'Delete note', colorPalette: 'danger', onPress: handleDelete }] : []}
    />
  );
}
