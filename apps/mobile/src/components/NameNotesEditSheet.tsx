import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import EditSheet from '@/components/EditSheet';
import Field from '@/components/Field';
import TextInput from '@/components/TextInput';
import useEditSheet from '@/hooks/useEditSheet';
import { scale, space } from '@/styles/designTokens';
import changedValues from '@/utils/changedValues';
import isPresent from '@/utils/isPresent';
import noteText from '@/utils/noteText';

type NameNotes = { name: string; notes: string | null };

export type NameNotesEditSheetProps = {
  name: string;
  notes: string | null;
  title: string;
  namePlaceholder: string;
  notesLabel: string;
  notesPlaceholder: string;
  maxLengths?: { name?: number; notes?: number };
  testID?: string;
  onSave: (changes: Partial<NameNotes>) => Promise<unknown>;
};

/**
 * A record's name and notes as a draft sheet (an album's, a contact list's), saved on Save through
 * `onSave(changes)`. The draft starts from `name` and `notes` as they were when the sheet opened, so
 * a live update doesn't move its baseline, and Save sends only the fields that changed, so an edit
 * another device made meanwhile to the other field is kept. The name can't be empty; an emptied
 * note saves as none.
 */
export default function NameNotesEditSheet({
  name,
  notes,
  title,
  namePlaceholder,
  notesLabel,
  notesPlaceholder,
  maxLengths,
  testID,
  onSave,
}: NameNotesEditSheetProps) {
  const [seed] = useState<NameNotes>({ name, notes: noteText(notes) });
  const [draft, setDraft] = useState({ name: seed.name, notes: seed.notes ?? '' });
  const values: NameNotes = { name: draft.name.trim(), notes: noteText(draft.notes) };
  const changes = changedValues(seed, values);
  const { sheetProps } = useEditSheet({
    isValid: !!values.name,
    isDirty: isPresent(changes),
    save: () => onSave(changes),
    syncsItself: true,
  });

  function setField(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <EditSheet {...sheetProps} title={title} testID={testID}>
      <View style={styles.fields}>
        <Field label="Name">
          <TextInput
            variant="field"
            value={draft.name}
            onChangeText={(text) => setField('name', text)}
            placeholder={namePlaceholder}
            maxLength={maxLengths?.name}
          />
        </Field>
        <Field label={notesLabel}>
          <TextInput
            variant="field"
            multiline
            value={draft.notes}
            onChangeText={(text) => setField('notes', text)}
            placeholder={notesPlaceholder}
            maxLength={maxLengths?.notes}
            minHeight={scale(120)}
          />
        </Field>
      </View>
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: space.xl,
  },
});
