import { promptButtonCollection } from '@squidbox/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import IconPicker from './IconPicker';

import EditSheet from '@/components/EditSheet';
import Field from '@/components/Field';
import TextInput from '@/components/TextInput';
import useEditSheet from '@/hooks/useEditSheet';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { scale } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import {
  createPromptButton,
  readPromptButton,
  removePromptButton,
  updatePromptButton,
} from '@/sync/promptButtonsRepository';
import changedValues from '@/utils/changedValues';
import confirmAsync from '@/utils/confirmAsync';
import getNewItemId from '@/utils/getNewItemId';
import isPresent from '@/utils/isPresent';

const { shape } = promptButtonCollection.schema;
const NAME_MAX_LENGTH = shape.name.maxLength;
const PROMPT_MAX_LENGTH = shape.prompt.maxLength;
// A button can't be without these.
const REQUIRED_FIELDS = ['name', 'prompt'];

// One prompt button as a draft sheet: `{ id }` edits it (Save, Duplicate, Delete), `{}` adds
// one at the end (Add, once it has a name and a prompt). Reachable from anywhere (a root screen, one
// per button), so the chat opens it too.
export default function PromptButtonScreen({ route, navigation }) {
  const { id } = route.params ?? {};
  const isAvailable = useLeaveWhenUnavailable();
  const seed = useSeedOrClose(
    (db) => (id ? readPromptButton(db, id) : Promise.resolve({ name: '', prompt: '', icon: null })),
    id ?? 'new',
    'This prompt button was deleted.',
  );
  if (!isAvailable || !seed) return null;
  return <PromptButtonEditor id={id} seed={seed} navigation={navigation} />;
}

function PromptButtonEditor({ id, seed, navigation }) {
  const [draft, setDraft] = useState({
    name: seed.name,
    prompt: seed.prompt,
    icon: seed.icon,
  });
  const values = { name: draft.name.trim(), prompt: draft.prompt.trim(), icon: draft.icon };
  const changes = changedValues(seed, values);
  const { sheetProps, finish, confirmDiscard } = useEditSheet({
    isNew: !id,
    isValid: REQUIRED_FIELDS.every((field) => values[field]),
    isDirty: isPresent(changes),
    save,
  });

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  // An edit writes only what changed, so an edit another device made meanwhile to another field is
  // kept.
  async function save() {
    const db = getDb();
    if (id) await updatePromptButton(db, id, changes);
    else await createPromptButton(db, { id: getNewItemId(), ...values });
  }

  // A copy of the button as stored at the end of the list, opened in place of this one. Unsaved
  // changes are discarded first (asked before the copy is made, so Keep editing leaves no copy).
  async function handleDuplicate() {
    if (!(await confirmDiscard())) return;
    await finish(async () => {
      const db = getDb();
      const button = await readPromptButton(db, id);
      if (!button) throw new Error('This prompt button was deleted.');
      const copy = await createPromptButton(db, {
        id: getNewItemId(),
        name: `${button.name} copy`.slice(0, NAME_MAX_LENGTH),
        prompt: button.prompt,
        icon: button.icon,
      });
      return () => navigation.replace('PromptButtonScreen', { id: copy.id });
    }, "Couldn't duplicate the prompt button");
  }

  async function handleDelete() {
    const isConfirmed = await confirmAsync({
      title: `Delete “${values.name || seed.name}”?`,
      message: 'It goes from every device.',
      action: 'Delete',
      destructive: true,
    });
    if (!isConfirmed) return;
    await finish(() => removePromptButton(getDb(), id), "Couldn't delete the prompt button");
  }

  return (
    <EditSheet
      {...sheetProps}
      title="Prompt button"
      actions={
        id
          ? [
              { label: 'Duplicate', onPress: handleDuplicate },
              { label: 'Delete prompt button', colorPalette: 'danger', onPress: handleDelete },
            ]
          : []
      }
    >
      <View style={styles.fields}>
        <Field label="Name">
          <TextInput
            variant="field"
            value={draft.name}
            onChangeText={(text) => setField('name', text)}
            placeholder="e.g. Shorter"
            maxLength={NAME_MAX_LENGTH}
            autoFocus={!id}
          />
        </Field>
        <Field label="Prompt">
          <TextInput
            variant="field"
            multiline
            value={draft.prompt}
            onChangeText={(text) => setField('prompt', text)}
            placeholder="e.g. Make it shorter. Keep the hook, cut the rest."
            maxLength={PROMPT_MAX_LENGTH}
            minHeight={scale(140)}
          />
        </Field>
        <Field label="Icon">
          <IconPicker value={draft.icon} onChange={(icon) => setField('icon', icon)} />
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
