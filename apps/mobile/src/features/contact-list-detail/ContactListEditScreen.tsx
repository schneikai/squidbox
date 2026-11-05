import { CONTACT_LIST_LIMITS } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import EditSheet from '@/components/EditSheet';
import Field from '@/components/Field';
import TextInput from '@/components/TextInput';
import useContacts from '@/features/contacts-context/useContacts';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useEditSheet from '@/hooks/useEditSheet';
import { scale } from '@/styles/designTokens';
import { schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';
import changedValues from '@/utils/changedValues';
import isPresent from '@/utils/isPresent';
import noteText from '@/utils/noteText';

// Edit list, from the list's ⋯ menu: its name and description as a draft sheet, saved on Save. It
// sends only what changed, so an edit another device made meanwhile to the other field is kept.
export default function ContactListEditScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const list = useLiveRecord<schema.ContactListRow>(schema.contactLists, listId);
  useCloseWhenGone(list, 'This list was deleted');

  if (!list) return null;
  return <ContactListEditor list={list} />;
}

type ContactListEditorProps = { list: schema.ContactListRow };
type ListDraft = { name: string; notes: string };

function ContactListEditor({ list }: ContactListEditorProps) {
  const { updateList } = useContacts();
  // The list as it was when the sheet opened, so a live update doesn't move the draft's baseline.
  const [seed] = useState({ name: list.name, notes: noteText(list.notes) });
  const [draft, setDraft] = useState<ListDraft>({ name: seed.name, notes: seed.notes ?? '' });
  const values = { name: draft.name.trim(), notes: noteText(draft.notes) };
  const changes = changedValues(seed, values);
  const { sheetProps } = useEditSheet({
    isValid: !!values.name,
    isDirty: isPresent(changes),
    save: () => updateList(list.id, changes),
    syncsItself: true,
  });

  function setField(field: keyof ListDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <EditSheet {...sheetProps} title="Edit list">
      <View style={styles.fields}>
        <Field label="Name">
          <TextInput
            variant="field"
            value={draft.name}
            onChangeText={(text) => setField('name', text)}
            placeholder="List name"
            maxLength={CONTACT_LIST_LIMITS.name}
          />
        </Field>
        <Field label="Description">
          <TextInput
            variant="field"
            multiline
            value={draft.notes}
            onChangeText={(text) => setField('notes', text)}
            placeholder="What this list is for"
            maxLength={CONTACT_LIST_LIMITS.notes}
            minHeight={scale(120)}
          />
        </Field>
      </View>
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: 20,
  },
});
