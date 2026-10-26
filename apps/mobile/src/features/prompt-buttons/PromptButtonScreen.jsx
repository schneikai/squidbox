import { promptButtonCollection } from '@squidbox/shared';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import IconPicker from './IconPicker';
import SegmentedControl from './SegmentedControl';
import placementText, { PLACEMENTS } from './placementText';

import Card from '@/components/Card';
import DetailScrollView from '@/components/DetailScrollView';
import Field from '@/components/Field';
import Page from '@/components/Page';
import TextButton from '@/components/TextButton';
import TextInput from '@/components/TextInput';
import Textarea from '@/components/Textarea';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { SCREEN_PADDING } from '@/constants';
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
const SHOW_IT_ITEMS = PLACEMENTS.map((key) => ({ key, label: placementText[key].title }));
// A button can't be without these.
const REQUIRED_FIELDS = ['name', 'prompt'];

// One prompt button, saved as you type: `{ id }` edits it, `{ placement }` adds one there, created
// once it has a name and a prompt and dropped if you leave without them. Reachable from anywhere (a
// root screen, one per button), so the chat opens it too.
export default function PromptButtonScreen({ route, navigation }) {
  const { id, placement } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const seed = useSeedOrClose(
    (db) => (id ? readPromptButton(db, id) : Promise.resolve({ name: '', prompt: '', placement, icon: null })),
    id ?? placement,
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
    placement: seed.placement,
    icon: seed.icon,
  });
  // The button's id once there is one (a new one gets it with its name and prompt), and whether
  // Delete or Duplicate is under way, after which nothing more is saved here.
  const idRef = useRef(id);
  const isDoneRef = useRef(false);
  const flush = useSaveAsYouType(
    { name: draft.name.trim(), prompt: draft.prompt.trim(), placement: draft.placement, icon: draft.icon },
    saveFields,
  );

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveFields(next, previous, { isLeaving }) {
    if (isDoneRef.current) return true;
    const db = getDb();
    const isComplete = REQUIRED_FIELDS.every((field) => next[field]);
    if (!idRef.current) {
      if (!isComplete) return false;
      idRef.current = (await createPromptButton(db, { id: getNewItemId(), ...next })).id;
      requestSync();
      return true;
    }
    if (!isComplete && isLeaving && !id) {
      // A button this screen added goes when you leave it without a name or a prompt.
      await removePromptButton(db, idRef.current);
      requestSync();
      return false;
    }
    // Only what changed, so an edit another device made meanwhile to another field is kept; an
    // emptied name or prompt keeps its stored text.
    const changes = changedValues(previous, next);
    for (const field of REQUIRED_FIELDS) if (!next[field]) delete changes[field];
    if (Object.keys(changes).length > 0) {
      await updatePromptButton(db, idRef.current, changes);
      requestSync();
    }
    return isComplete;
  }

  // Runs a last write on this button; a failed one keeps the screen open and says so.
  async function finish(write, failure) {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    try {
      await write();
      requestSync();
    } catch (error) {
      console.error(failure, error);
      haptics.error();
      Alert.alert(failure, error.message);
      isDoneRef.current = false;
    }
  }

  // A copy of the button as it is now at the end of its group, opened in place of this one.
  async function handleDuplicate() {
    await flush();
    await finish(async () => {
      const db = getDb();
      const button = await readPromptButton(db, id);
      if (!button) return;
      const copy = await createPromptButton(db, {
        id: getNewItemId(),
        name: `${button.name} copy`.slice(0, NAME_MAX_LENGTH),
        prompt: button.prompt,
        placement: button.placement,
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
          <Card>
            <TextInput
              value={draft.name}
              onChangeText={(text) => setField('name', text)}
              onBlur={() => flush()}
              placeholder="e.g. Shorter"
              maxLength={NAME_MAX_LENGTH}
              autoFocus={!id}
              style={styles.input}
            />
          </Card>
        </Field>
        <Field label="Prompt">
          <Card>
            <Textarea
              value={draft.prompt}
              onChangeText={(text) => setField('prompt', text)}
              onBlur={() => flush()}
              placeholder="e.g. Make each option shorter. Keep the hook, cut the rest."
              maxLength={PROMPT_MAX_LENGTH}
              minHeight={scale(140)}
              style={styles.input}
            />
          </Card>
        </Field>
        <Field label="Show it">
          <SegmentedControl
            items={SHOW_IT_ITEMS}
            activeKey={draft.placement}
            onSelect={(key) => setField('placement', key)}
          />
        </Field>
        <Field label="Icon">
          <IconPicker value={draft.icon} onChange={(icon) => setField('icon', icon)} />
        </Field>
        {id && (
          <View style={styles.actions}>
            <TextButton label="Duplicate" onPress={handleDuplicate} />
            <TextButton label="Delete prompt button" tone="danger" onPress={handleDelete} />
          </View>
        )}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
  },
  input: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  actions: {
    paddingTop: 24,
  },
});
