import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import EditSheet from '@/components/EditSheet';
import Field from '@/components/Field';
import Switch from '@/components/Switch';
import TextInput from '@/components/TextInput';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useEditSheet from '@/hooks/useEditSheet';
import { scale, space } from '@/styles/designTokens';
import changedValues from '@/utils/changedValues';
import isPresent from '@/utils/isPresent';
import noteText from '@/utils/noteText';

type NameNotes = { name: string; notes: string | null; starred?: boolean };

export type NameNotesEditSheetProps = {
  name: string;
  notes: string | null;
  starred?: boolean;
  title: string;
  namePlaceholder: string;
  notesLabel: string;
  notesPlaceholder: string;
  maxLengths?: { name?: number; notes?: number };
  focus?: 'name' | 'notes';
  testID?: string;
  onSave: (changes: Partial<NameNotes>) => Promise<unknown>;
};

/**
 * A record's name and notes as a draft sheet (an album's, a contact list's), saved on Save through
 * `onSave(changes)`. The draft starts from `name` and `notes` as they were when the sheet opened, so
 * a live update doesn't move its baseline, and Save sends only the fields that changed, so an edit
 * another device made meanwhile to the other field is kept. The name can't be empty; an emptied
 * note saves as none. `starred` (an album's) adds a Starred switch to the draft. `focus` puts the cursor in
 * that field when the sheet opens.
 */
export default function NameNotesEditSheet({
  name,
  notes,
  starred,
  title,
  namePlaceholder,
  notesLabel,
  notesPlaceholder,
  maxLengths,
  focus,
  testID,
  onSave,
}: NameNotesEditSheetProps) {
  const [seed] = useState<NameNotes>({ name: name.trim(), notes: noteText(notes), starred });
  const [draft, setDraft] = useState({ name: seed.name, notes: seed.notes ?? '', starred: seed.starred });
  const values: NameNotes = { name: draft.name.trim(), notes: noteText(draft.notes), starred: draft.starred };
  const changes = changedValues(seed, values);
  const { sheetProps } = useEditSheet({
    isValid: !!values.name,
    isDirty: isPresent(changes),
    save: () => onSave(changes),
    syncsItself: true,
  });

  function setField(field: 'name' | 'notes', value: string) {
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
            autoFocus={focus === 'name'}
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
            autoFocus={focus === 'notes'}
            minHeight={scale(120)}
          />
        </Field>
        {draft.starred !== undefined && (
          <Section>
            <Row label="Starred">
              <Switch
                value={draft.starred}
                onValueChange={(value) => setDraft((current) => ({ ...current, starred: value }))}
                accessibilityLabel="Starred"
              />
            </Row>
          </Section>
        )}
      </View>
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: space.xl,
  },
});
