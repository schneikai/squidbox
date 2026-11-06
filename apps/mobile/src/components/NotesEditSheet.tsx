import { useState } from 'react';

import TextEditSheet from '@/components/TextEditSheet';
import useEditSheet from '@/hooks/useEditSheet';
import noteText from '@/utils/noteText';

/**
 * A record's notes as a draft sheet (an album's, a contact list's), saved on Save through
 * `onSave(notes)`: the draft starts from `notes` as they were when the sheet opened, an emptied note
 * saves as none, and Delete note (while it had one) saves none. Sent only on Save, so a notes edit
 * another device made meanwhile is kept unless you change them. `maxLength`: the longest note.
 */
export type NotesEditSheetProps = {
  notes: string | null;
  maxLength?: number;
  onSave: (notes: string | null) => Promise<unknown>;
};

export default function NotesEditSheet({ notes: storedNotes, maxLength, onSave }: NotesEditSheetProps) {
  const [initialNotes] = useState(storedNotes);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const { sheetProps, finish } = useEditSheet({
    isDirty: noteText(notes) !== noteText(initialNotes),
    save: () => onSave(noteText(notes)),
    syncsItself: true,
  });

  function handleDelete() {
    finish(() => onSave(null), "Couldn't delete the note");
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title="Notes"
      value={notes}
      onChangeText={setNotes}
      maxLength={maxLength}
      placeholder="Add a note…"
      autoFocus
      actions={noteText(initialNotes) ? [{ label: 'Delete note', colorPalette: 'danger', onPress: handleDelete }] : []}
    />
  );
}
