import { promptButtonCollection } from '@squidbox/shared';
import { useRef, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import IconPicker from './IconPicker';

import ActionButtons from '@/components/ActionButtons';
import CardTextField from '@/components/CardTextField';
import DetailScrollView from '@/components/DetailScrollView';
import Field from '@/components/Field';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { scale } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import {
  createPromptButton,
  readPromptButton,
  removePromptButton,
  updatePromptButton,
} from '@/sync/promptButtonsRepository';
import { requestSync } from '@/sync/worker';
import changedValues from '@/utils/changedValues';
import confirmAsync from '@/utils/confirmAsync';
import getNewItemId from '@/utils/getNewItemId';

const { shape } = promptButtonCollection.schema;
const NAME_MAX_LENGTH = shape.name.maxLength;
const PROMPT_MAX_LENGTH = shape.prompt.maxLength;
// A button can't be without these.
const REQUIRED_FIELDS = ['name', 'prompt'];

// One prompt button, saved as you type: `{ id }` edits it, `{}` adds one at the end, created
// once it has a name and a prompt and dropped if you leave without them. Reachable from anywhere (a
// root screen, one per button), so the chat opens it too.
export default function PromptButtonScreen({ route, navigation }) {
  const { id } = route.params;
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
  const haptics = useHaptics();
  const [draft, setDraft] = useState({
    name: seed.name,
    prompt: seed.prompt,
    icon: seed.icon,
  });
  // The button's id once there is one (a new one gets it with its name and prompt).
  const idRef = useRef(id);
  const { flush, end } = useSaveAsYouType(
    { name: draft.name.trim(), prompt: draft.prompt.trim(), icon: draft.icon },
    saveFields,
  );

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  // Resolves to what is stored after it (see useSaveAsYouType).
  async function saveFields(next, stored, { isLeaving }) {
    const db = getDb();
    const isComplete = REQUIRED_FIELDS.every((field) => next[field]);
    if (!idRef.current) {
      if (!isComplete) return false;
      idRef.current = (await createPromptButton(db, { id: getNewItemId(), ...next })).id;
      return next;
    }
    if (!isComplete && isLeaving && !id) {
      // A button this screen added goes when you leave it without a name or a prompt.
      await removePromptButton(db, idRef.current);
      return false;
    }
    // Only what changed, so an edit another device made meanwhile to another field is kept; an
    // emptied name or prompt keeps its stored text.
    const changes = changedValues(stored, next);
    for (const field of REQUIRED_FIELDS) if (!next[field]) delete changes[field];
    if (Object.keys(changes).length === 0) return false;
    await updatePromptButton(db, idRef.current, changes);
    return { ...stored, ...changes };
  }

  // A last write on this button, after the saves under way; nothing typed is saved after it. A
  // failed one keeps the screen open and says so.
  async function finish(write, failure) {
    try {
      await end(write);
      requestSync();
    } catch (error) {
      console.error(failure, error);
      haptics.error();
      Alert.alert(failure, error.message);
    }
  }

  // A copy of the button as it is now at the end of the list, opened in place of this one.
  async function handleDuplicate() {
    await flush();
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
      navigation.replace('PromptButtonScreen', { id: copy.id });
    }, "Couldn't duplicate the prompt button");
  }

  async function handleDelete() {
    const isConfirmed = await confirmAsync({
      title: `Delete “${draft.name.trim() || seed.name}”?`,
      message: 'It goes from every device.',
      action: 'Delete',
      destructive: true,
    });
    if (!isConfirmed) return;
    await finish(async () => {
      await removePromptButton(getDb(), id);
      navigation.goBack();
    }, "Couldn't delete the prompt button");
  }

  return (
    <Page>
      <FloatingDetailHeader title="Prompt button" onBack={() => navigation.goBack()} />
      <DetailScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Field label="Name">
          <CardTextField
            value={draft.name}
            onChangeText={(text) => setField('name', text)}
            onBlur={() => flush()}
            placeholder="e.g. Shorter"
            maxLength={NAME_MAX_LENGTH}
            autoFocus={!id}
          />
        </Field>
        <Field label="Prompt">
          <CardTextField
            multiline
            value={draft.prompt}
            onChangeText={(text) => setField('prompt', text)}
            onBlur={() => flush()}
            placeholder="e.g. Make it shorter. Keep the hook, cut the rest."
            maxLength={PROMPT_MAX_LENGTH}
            minHeight={scale(140)}
          />
        </Field>
        <Field label="Icon">
          <IconPicker value={draft.icon} onChange={(icon) => setField('icon', icon)} />
        </Field>
        {id && (
          <ActionButtons
            isScreenEnd
            actions={[
              { label: 'Duplicate', onPress: handleDuplicate },
              { label: 'Delete prompt button', colorPalette: 'danger', onPress: handleDelete },
            ]}
          />
        )}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
  },
});
