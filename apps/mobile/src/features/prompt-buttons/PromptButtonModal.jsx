import { promptButtonCollection } from '@squidbox/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SegmentedControl from './SegmentedControl';
import placementText, { PLACEMENTS } from './placementText';

import Card from '@/components/Card';
import DetailScrollView from '@/components/DetailScrollView';
import Field from '@/components/Field';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import TextButton from '@/components/TextButton';
import TextInput from '@/components/TextInput';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import useConfirmDiscard from '@/hooks/useConfirmDiscard';
import useHaptics from '@/hooks/useHaptics';
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
import { requestSync } from '@/sync/worker';
import changedValues from '@/utils/changedValues';
import confirmAsync from '@/utils/confirmAsync';
import getNewItemId from '@/utils/getNewItemId';

const { shape } = promptButtonCollection.schema;
const NAME_MAX_LENGTH = shape.name.maxLength;
const PROMPT_MAX_LENGTH = shape.prompt.maxLength;
const SHOW_IT_ITEMS = PLACEMENTS.map((key) => ({ key, label: placementText[key].title }));

// One prompt button: `{ id }` edits it, `{ placement }` adds one there. Reachable from anywhere (a
// root modal, one per button), so the chat opens it too.
export default function PromptButtonModal({ route, navigation }) {
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
  const { bottom } = useSafeAreaInsets();
  const haptics = useHaptics();
  const [draft, setDraft] = useState({ name: seed.name, prompt: seed.prompt, placement: seed.placement });
  const isDirty = Object.keys(changedValues(seed, draft)).length > 0;
  const allowLeave = useConfirmDiscard(navigation, isDirty);

  const name = draft.name.trim();
  const prompt = draft.prompt.trim();
  // A new button's empty seed makes any name and prompt a change.
  const canSave = !!name && !!prompt && isDirty;

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    const db = getDb();
    // Only what changed, so an edit another device made meanwhile to another field is kept.
    if (id) await updatePromptButton(db, id, changedValues(seed, { name, prompt, placement: draft.placement }));
    else await createPromptButton(db, { id: getNewItemId(), name, prompt, placement: draft.placement, icon: null });
    requestSync();
    haptics.success();
    allowLeave();
    navigation.goBack();
  }

  // A copy of the saved button at the end of its group, opened in place of this one (which asks
  // first when it has changes).
  async function handleDuplicate() {
    const copy = await createPromptButton(getDb(), {
      id: getNewItemId(),
      name: `${seed.name} copy`.slice(0, NAME_MAX_LENGTH),
      prompt: seed.prompt,
      placement: seed.placement,
      icon: seed.icon,
    });
    requestSync();
    navigation.replace('PromptButtonModal', { id: copy.id });
  }

  async function handleDelete() {
    const isConfirmed = await confirmAsync({
      title: `Delete “${seed.name}”?`,
      message: 'It goes from every device.',
      action: 'Delete',
      destructive: true,
    });
    if (!isConfirmed) return;
    await removePromptButton(getDb(), id);
    requestSync();
    allowLeave();
    navigation.goBack();
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Prompt button"
        rightSlot={<PrimaryButton size="compact" label="Save" onPress={handleSave} disabled={!canSave} />}
      />
      <DetailScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + SCREEN_PADDING }]}
      >
        <Field label="Name">
          <Card>
            <TextInput
              value={draft.name}
              onChangeText={(text) => setField('name', text)}
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
        {id && (
          <View style={styles.actions}>
            <TextButton label="Duplicate" onPress={handleDuplicate} />
            <TextButton label="Delete prompt button" tone="danger" onPress={handleDelete} />
          </View>
        )}
      </DetailScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT + 8,
    gap: 20,
  },
  input: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: 24,
  },
});
