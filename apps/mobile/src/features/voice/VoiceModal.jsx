import { PERSONA_FIELDS, PERSONA_LIMITS, uniqueTags } from '@squidbox/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import ExamplePostsField from './ExamplePostsField';
import FieldInfoSheet from './FieldInfoSheet';
import RulesField from './RulesField';
import TagsField from './TagsField';
import useFillInForMe from './useFillInForMe';
import voiceFields from './voiceFields';

import Card from '@/components/Card';
import CatalogStatus from '@/components/CatalogStatus';
import Field from '@/components/Field';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import Switch from '@/components/Switch';
import TextButton from '@/components/TextButton';
import Textarea from '@/components/Textarea';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import FloatingPrimaryAction from '@/components/floating-bars/FloatingPrimaryAction';
import useFloatingPrimaryActionPadding from '@/components/floating-bars/useFloatingPrimaryActionPadding';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import useConfirmDiscard from '@/hooks/useConfirmDiscard';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useScrollY from '@/hooks/useScrollY';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import useLibrary from '@/library/useLibrary';
import { scale } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { EMPTY_PERSONA, readPersona, savePersona } from '@/sync/personaRepository';
import { requestSync } from '@/sync/worker';
import changedValues from '@/utils/changedValues';

// Settings → Assistant → Writing as you: what the assistant writes with, as plain fields, saved
// with Save. Reachable from anywhere (a root modal), so the chat opens it too.
export default function VoiceModal({ navigation }) {
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const seed = useSeedOrClose(async (db) => {
    const persona = await readPersona(db, userId);
    return persona ? pickPersonaFields(persona) : EMPTY_PERSONA;
  }, 'persona');
  if (!isAvailable || !seed) return null;
  return <VoiceEditor userId={userId} seed={seed} navigation={navigation} />;
}

// The fields of a saved persona, without its sync columns.
function pickPersonaFields(persona) {
  return Object.fromEntries(PERSONA_FIELDS.map((field) => [field, persona[field]]));
}

function VoiceEditor({ userId, seed, navigation }) {
  const haptics = useHaptics();
  const { scrollY, onScroll } = useScrollY();
  const paddingBottom = useFloatingPrimaryActionPadding();
  const [draft, setDraft] = useState(seed);
  const [info, setInfo] = useState({ field: 'aboutYou', isVisible: false });
  const [isSaving, setIsSaving] = useState(false);
  // One setter per field that keeps its identity, so typing in one field leaves the others' lists
  // (memo) alone.
  const [setters] = useState(() =>
    Object.fromEntries(
      PERSONA_FIELDS.map((field) => [field, (value) => setDraft((current) => ({ ...current, [field]: value }))]),
    ),
  );
  const fillIn = useFillInForMe(draft, setDraft);
  const isDirty = Object.keys(changedValues(seed, draft)).length > 0;
  const allowLeave = useConfirmDiscard(navigation, isDirty);

  function showInfo(field) {
    setInfo({ field, isVisible: true });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      // Only what the user changed, so a field another device edited meanwhile keeps that edit.
      await savePersona(getDb(), userId, changedValues(seed, normalized(draft)));
      requestSync();
      haptics.success();
      allowLeave();
      navigation.goBack();
    } catch (error) {
      console.error('Saving Writing as you failed', error);
      haptics.error();
      setIsSaving(false);
    }
  }

  function textField(field, maxLength) {
    const { label, placeholder } = voiceFields[field];
    return (
      <Field label={label} onInfo={() => showInfo(field)}>
        <Card>
          <Textarea
            value={draft[field]}
            onChangeText={setters[field]}
            placeholder={placeholder}
            maxLength={maxLength}
            minHeight={scale(88)}
            style={styles.textarea}
          />
        </Card>
      </Field>
    );
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Writing as you"
        rightSlot={
          <PrimaryButton size="compact" label="Save" onPress={handleSave} disabled={!isDirty} loading={isSaving} />
        }
        scrollY={scrollY}
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom }]}
      >
        {textField('aboutYou', PERSONA_LIMITS.aboutYou)}
        <Field label={voiceFields.contentTags.label} onInfo={() => showInfo('contentTags')}>
          <TagsField
            tags={draft.contentTags}
            onChange={setters.contentTags}
            placeholder={voiceFields.contentTags.placeholder}
          />
        </Field>
        <View style={styles.toneGroup}>
          {textField('tone', PERSONA_LIMITS.tone)}
          <Section>
            <Row label={voiceFields.useEmoji.label} description={voiceFields.useEmoji.description}>
              <Switch value={draft.useEmoji} onValueChange={setters.useEmoji} />
            </Row>
          </Section>
        </View>
        <Field label={voiceFields.rules.label} onInfo={() => showInfo('rules')}>
          <RulesField rules={draft.rules} onChange={setters.rules} placeholder={voiceFields.rules.placeholder} />
        </Field>
        <Field label={voiceFields.examplePosts.label} onInfo={() => showInfo('examplePosts')}>
          <ExamplePostsField
            posts={draft.examplePosts}
            onChange={setters.examplePosts}
            placeholder={voiceFields.examplePosts.placeholder}
          />
        </Field>
        {fillIn.catalogError && <CatalogStatus error={fillIn.catalogError} retry={fillIn.retry} />}
      </Animated.ScrollView>
      <FloatingPrimaryAction align="center">
        <FloatingPill>
          <TextButton
            icon="sparkle"
            label="Fill it in for me"
            onPress={fillIn.fill}
            disabled={!fillIn.canFill}
            loading={fillIn.isDrafting}
          />
        </FloatingPill>
      </FloatingPrimaryAction>
      <FieldInfoSheet
        field={info.field}
        isVisible={info.isVisible}
        onClose={() => setInfo((current) => ({ ...current, isVisible: false }))}
      />
    </ModalSheet>
  );
}

// The draft as it is saved: texts trimmed, the empty rules, posts and tags dropped, a tag once.
function normalized(draft) {
  const kept = (list) => list.map((text) => text.trim()).filter(Boolean);
  return {
    aboutYou: draft.aboutYou.trim(),
    contentTags: uniqueTags(draft.contentTags).slice(0, PERSONA_LIMITS.contentTags),
    tone: draft.tone.trim(),
    useEmoji: draft.useEmoji,
    rules: kept(draft.rules),
    examplePosts: kept(draft.examplePosts),
  };
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT,
    paddingHorizontal: SCREEN_PADDING,
    gap: 20,
  },
  textarea: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  toneGroup: {
    gap: 8,
  },
});
