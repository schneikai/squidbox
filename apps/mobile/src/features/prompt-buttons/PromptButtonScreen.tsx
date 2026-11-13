import { PROMPT_BUTTON_LIMITS, type PromptButtonFields } from '@squidbox/shared';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import IconPicker from './IconPicker';

import EditSheet from '@/components/EditSheet';
import Field from '@/components/Field';
import TextInput from '@/components/TextInput';
import useEditSheet from '@/hooks/useEditSheet';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { scale, space } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import {
  createPromptButton,
  readPromptButton,
  removePromptButton,
  updatePromptButton,
} from '@/sync/promptButtonsRepository';
import changedValues from '@/utils/changedValues';
import confirmDeleteAsync from '@/utils/confirmDeleteAsync';
import getNewItemId from '@/utils/getNewItemId';
import isPresent from '@/utils/isPresent';

// A button can't be without these.
const REQUIRED_FIELDS = ['name', 'prompt'] as const;

// One prompt button as a draft sheet: `…/prompt-buttons/[id]` edits it (Save, Duplicate, Delete),
// `…/prompt-buttons/new` adds one at the end (Add, once it has a name and a prompt). Opened from the
// list, in Settings or inside the chat's sheet.
export default function PromptButtonScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isAvailable = useLeaveWhenUnavailable();
  const seed = useSeedOrClose<PromptButtonFields>(
    (db) => (id ? readPromptButton(db, id) : Promise.resolve({ name: '', prompt: '', icon: null })),
    id ?? 'new',
    'This prompt button was deleted.',
  );
  if (!isAvailable || !seed) return null;
  return <PromptButtonEditor id={id} seed={seed} />;
}

type PromptButtonEditorProps = {
  id: string | undefined;
  seed: PromptButtonFields;
};
function PromptButtonEditor({ id, seed }: PromptButtonEditorProps) {
  const pathname = usePathname();
  const [draft, setDraft] = useState<PromptButtonFields>({
    name: seed.name,
    prompt: seed.prompt,
    icon: seed.icon,
  });
  const values: PromptButtonFields = { name: draft.name.trim(), prompt: draft.prompt.trim(), icon: draft.icon };
  const changes = changedValues(seed, values);
  const { sheetProps, finish, confirmDiscard } = useEditSheet({
    isNew: !id,
    isValid: REQUIRED_FIELDS.every((field) => values[field]),
    isDirty: isPresent(changes),
    save,
  });

  function setField<K extends keyof PromptButtonFields>(field: K, value: PromptButtonFields[K]) {
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
  async function handleDuplicate(buttonId: string) {
    if (!(await confirmDiscard())) return;
    await finish(async () => {
      const db = getDb();
      const button = await readPromptButton(db, buttonId);
      if (!button) throw new Error('This prompt button was deleted.');
      const copy = await createPromptButton(db, {
        id: getNewItemId(),
        name: `${button.name} copy`.slice(0, PROMPT_BUTTON_LIMITS.name),
        prompt: button.prompt,
        icon: button.icon,
      });
      return () => router.replace(pathname.replace(/[^/]+$/, copy.id));
    }, "Couldn't duplicate the prompt button");
  }

  async function handleDelete(buttonId: string) {
    if (!(await confirmDeleteAsync({ name: values.name || seed.name, also: 'It goes from every device.' }))) return;
    await finish(() => removePromptButton(getDb(), buttonId), "Couldn't delete the prompt button");
  }

  return (
    <EditSheet
      {...sheetProps}
      title="Prompt button"
      actions={
        id
          ? [
              { label: 'Duplicate', onPress: () => handleDuplicate(id) },
              { label: 'Delete prompt button', colorPalette: 'danger', onPress: () => handleDelete(id) },
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
            maxLength={PROMPT_BUTTON_LIMITS.name}
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
            maxLength={PROMPT_BUTTON_LIMITS.prompt}
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
    gap: space.xl,
  },
});
